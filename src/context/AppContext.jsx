import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { ThermalPrinterClient, WebBluetoothAdapter } from 'mxw01-thermal-printer';
const AppContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_BASE_URL, { transports: ['websocket'] });

// --- HELPER: THERMAL RECEIPT GENERATOR ---
const generateReceiptHTML = (order) => `
  <html>
    <head>
      <style>
        @page { margin: 0; size: auto; }
        body { 
          font-family: 'Courier New', monospace; 
          width: 210pt; 
          padding: 10px;
          margin: 0;
          color: #000;
          font-size: 10pt;
        }
        .center { text-align: center; }
        .dashed { border-bottom: 1px dashed #000; margin: 8px 0; }
        .bold { font-weight: bold; font-size: 12pt; }
        .student-name { font-weight: bold; text-transform: uppercase; margin-top: 4px; }
        .footer { margin-top: 15px; font-size: 8pt; text-align: center; }
        .item-row { display: flex; justify-content: space-between; margin: 5px 0; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body onload="window.print(); window.onafterprint = function(){ window.close(); }">
      <div class="center">
        <div class="bold">OFFICIAL RECEIPT</div>
        <div style="font-size: 8pt;">SMARTCLAIM SYSTEM</div>
        <p>Order ID: #${order.id}</p>
      </div>
      <div class="dashed"></div>
      <div style="font-size: 9pt;">
        <div class="student-name">${order.full_name || 'Guest Student'}</div>
        <div>ID: ${order.user_id}</div>
        <div>Date: ${new Date().toLocaleString()}</div>
      </div>
      <div class="dashed"></div>
      <div class="item-row">
        <span>${order.item_name}</span>
        <span>${order.size}</span>
      </div>
      <div class="dashed"></div>
      <div class="center bold" style="margin-top:10px;">
        STATUS: CLAIMED
      </div>
      <div class="footer">
        *** END OF RECEIPT ***
      </div>
    </body>
  </html>
`;

export const AppProvider = ({ children }) => {
  const [user, setUserState] = useState(() => {
    const saved = localStorage.getItem('app_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const setUser = (userData) => {
    if (userData) {
      localStorage.setItem('app_user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('app_user');
      localStorage.removeItem('token');
    }
    setUserState(userData);
  };

  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [officeStatus, setOfficeStatus] = useState('OPEN');
  const [loading, setLoading] = useState(false);
  const [isAutoSchedule, setIsAutoSchedule] = useState(false);
  const [privateAlert, setPrivateAlert] = useState(null);

  // --- DYNAMIC QUEUE CALCULATION ---
  const currentQueue = useMemo(() => {
    if (!orders || orders.length === 0) return 0;

    return orders.filter(o => {
      // Force status to a clean, uppercase string
      const s = String(o.status || "").toUpperCase().trim();

      // An order is "In the Queue" if it's PENDING or READY
      const isActive = ['PENDING', 'AWAITING_VERIFICATION', 'READY', 'IN_PROGRESS'].includes(s);

      // An order is "Gone" if it's CLAIMED
      const isFinished = ['CLAIMED', 'RELEASED', 'COMPLETED', 'VOIDED'].includes(s);

      return isActive && !isFinished;
    }).length;
  }, [orders]);

  const api = async (url, method = 'GET', body = null) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal, // Connect the abort signal
      };
      if (body) options.body = JSON.stringify(body);

      const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, options);
      clearTimeout(id); // Clear timeout on success

      const data = await response.json();
      return { ok: response.ok, data, status: response.status };
    } catch (err) {
      clearTimeout(id);
      console.error("API Error:", err);
      return { ok: false, data: { message: "Request timed out or server offline." } };
    }
  };

  const normalizeUser = useCallback((u) => {
    if (!u) return null;
    const id = u.user_id || u.id;
    return {
      ...u,
      id,
      user_id: id,
      name: u.full_name || u.name || "Unknown User",
      role: u.role?.toLowerCase() || 'student',
      // 🛡️ Ensure this line is exactly like this to handle 1/0 from DB
      is_verified: Number(u.is_verified) === 1,
      isVerified: Number(u.is_verified) === 1
    };
  }, []);

  const refreshData = useCallback(async () => {
    const currentId = user?.id || user?.user_id;
    if (!currentId) return;

    setLoading(true);
    try {
      // 1. Fetch Users FIRST if Admin
      // This ensures 'Marvin Test' is in the users list BEFORE we process orders
      let fetchedUsers = [];
      if (user.role?.toLowerCase() === 'admin') {
        const uRes = await api(`/api/admin/users?adminId=${currentId}`);
        if (uRes.ok && Array.isArray(uRes.data)) {
          fetchedUsers = uRes.data.map(normalizeUser);
          setUsers(fetchedUsers);
        }
      }

      // 2. Fetch everything else
      const [itemsRes, annRes, ordersRes] = await Promise.all([
        api('/api/items'),
        api('/api/announcements'),
        api('/api/orders')
      ]);

      if (itemsRes.ok) setItems(itemsRes.data);
      if (annRes.ok) setAnnouncements(annRes.data);

      if (ordersRes.ok && Array.isArray(ordersRes.data)) {
        // 3. ENRICHMENT MAPPING
        // Even if the SQL JOIN fails for some reason, we manually 
        // attach the name from our fetchedUsers list as a backup.
        const enrichedOrders = ordersRes.data.map(order => {
          const student = fetchedUsers.find(u => String(u.id) === String(order.user_id || order.userId));
          return {
            ...order,
            full_name: order.full_name || student?.name || "Guest Student"
          };
        });

        console.log("Admin Sync: Data enriched with names", enrichedOrders.length);
        setOrders(enrichedOrders);
      }

    } catch (err) {
      console.error("Refresh Failure:", err);
    } finally {
      setLoading(false);
    }
  }, [user, normalizeUser]);

  useEffect(() => {
    if (user?.id) refreshData();
  }, [user?.id, user?.role, refreshData]);

  useEffect(() => {
    const events = {
      office_status_updated: setOfficeStatus,
      private_note: (c) => { setPrivateAlert(c); setTimeout(() => setPrivateAlert(null), 8000); },
      order_created: (n) => setOrders(prev => {
        // 🛡️ THE GATEKEEPER: If ID already exists, do NOT add it again.
        if (prev.some(o => String(o.id) === String(n.id))) {
          return prev;
        }
        return [n, ...prev];
      }),
      new_announcement: (n) => setAnnouncements(prev => [n, ...prev]),
      item_deleted: (id) => setItems(prev => prev.filter(i => i.id !== parseInt(id))),
      inventory_updated: (d) => setItems(prev => prev.map(i =>
        i.id === d.itemId
          ? { ...i, ...d, is_low_stock: i.is_low_stock } // 🛡️ Keep the local manual status
          : i
      )),
      order_updated: (d) => {
        setOrders(prev => {
          // 🛡️ PRE-CHECK: If 'd' contains a new order object entirely (sometimes happens in sockets),
          // we must ensure we aren't creating a duplicate ID in the list.
          return prev.map(o => {
            const orderId = String(o.id);

            // Normalize incoming IDs to strings for comparison
            const targetIds = Array.isArray(d.ids) ? d.ids.map(id => String(id)) : [];
            const singleId = d.id || d.orderId ? String(d.id || d.orderId) : null;

            const isTarget = targetIds.includes(orderId) || orderId === singleId;

            if (isTarget) {
              // 🛡️ FIX: Ensure status is clean and uppercase
              const rawStatus = d.status || o.status;
              const newStatus = String(rawStatus).toUpperCase().trim();

              // 🛡️ SAFE MERGE: 
              // We take the old order (...o), then apply the updates (...d),
              // but we explicitly OVERWRITE the 'id' and 'status' to ensure
              // they stay consistent and don't change types or casing.
              return {
                ...o,
                ...d,
                id: o.id, // Lock the ID to the original (usually number)
                status: newStatus
              };
            }
            return o;
          });
        });
      },
      user_updated: (u) => {
        const n = normalizeUser(u);
        setUsers(prev => prev.find(x => x.id === n.id) ? prev.map(x => x.id === n.id ? n : x) : [...prev, n]);
        if (user?.id === n.id) setUser(n);
      }
    };

    Object.entries(events).forEach(([e, f]) => socket.on(e, f));

    return () => {
      Object.entries(events).forEach(([e, f]) => socket.off(e, f));
    };
  }, [user?.id, normalizeUser]);

  const actions = {
    login: async (id, password) => {
      const r = await api('/api/auth/login', 'POST', { id, password });
      if (r.ok) {
        localStorage.setItem('token', r.data.token);
        setUser(normalizeUser(r.data.user));
        return { success: true };
      }
      return { success: false, message: r.data.message };
    },
    logout: () => { setUser(null); window.location.href = '/login'; },
    promoteUser: async (targetId, nextRole) => {
      // Ensure we are using user_id for the admin check
      const adminId = user?.user_id || user?.id;

      console.log("Sending Promote Request:", { targetId, nextRole, adminId });

      const r = await api('/api/admin/users/promote', 'PATCH', {
        targetUserId: String(targetId),
        adminId: adminId,
        newRole: nextRole // 'Admin' or 'Student'
      });

      if (r.ok) {
        // This local update keeps the name because we use ...u
        setUsers(prev => prev.map(u => {
          if (u.id === targetId || u.user_id === targetId) {
            return { ...u, role: nextRole };
          }
          return u;
        }));
        return { success: true };
      } else {
        alert(r.data?.message || "Failed to update role");
        return { success: false };
      }
    },
    verifyUser: async (targetUserId, newStatus) => {
      const r = await api('/api/users/manual-verify', 'POST', {
        adminId: user?.id,
        userId: targetUserId,
        newStatus
      });
      return { success: r.ok };
    },
    deleteUser: async (targetUserId) => {
      if (!window.confirm("Permanently delete this user?")) return;
      const r = await api(`/api/admin/users/${targetUserId}?adminId=${user?.id}`, 'DELETE');
      if (r.ok) {
        setUsers(prev => prev.filter(u => u.id !== targetUserId));
        return { success: true };
      }
      return { success: false };
    },
    requestOTP: async (targetEmail) => {
      return await api('/api/auth/request-otp', 'POST', {
        email: targetEmail,
        userId: user?.id
      });
    },

    /**
     * verifyOTP: Sends the code and the payload (new email, name, or password) 
     * to the server to finalize the change.
     */
    verifyOTP: async (otp, payload = {}) => {
      // 1. Identify the current user ID from state
      const currentId = user?.id || user?.user_id;

      // 2. Debug Log: This is crucial for fixing the 400 error. 
      // Check your browser console to see if 'otp' or 'userId' is undefined.
      console.log("📡 Sending Verification:", {
        otp: String(otp),
        userId: currentId,
        payload
      });

      const r = await api('/api/auth/verify-otp', 'POST', {
        // 3. Force OTP to string and trim spaces to match DB comparison
        otp: String(otp).trim(),
        ...payload,
        userId: currentId
      });

      if (r.ok) {
        // 4. If the server returns the updated user object, sync it to localStorage/State
        if (r.data && r.data.user) {
          setUser(normalizeUser(r.data.user));
        } else {
          await refreshData();
        }
        return { success: true };
      }

      // 5. Return the specific error message from the backend (e.g., "Invalid or expired OTP")
      return {
        success: false,
        message: r.data?.message || "Verification failed"
      };
    },
    updateProfile: async (profileData) => {
      const r = await api('/api/users/update-profile', 'PATCH', {
        ...profileData,
        userId: user?.id || user?.user_id
      });

      if (r.ok) {
        setUser(normalizeUser(r.data.user));
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Update failed" };
    },
    // --- PRINT & ANALYTICS ---
    printReceipt: async (order) => {
      // 🛡️ FIX: Ensure we use 'order.full_name' which we enriched in refreshData
      const studentName = order.full_name || "Guest Student";
      const uniqueId = order.id; // This MUST be the primary key from the DB

      try {
        console.log(`Starting Print for Unique Order: #${uniqueId}`);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 384;
        canvas.height = 160;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 26px Courier';
        ctx.textAlign = 'center';
        ctx.fillText("OFFICIAL RECEIPT", 192, 40);

        ctx.font = '22px Courier';
        // Use the Unique ID here so the scanner knows EXACTLY which row to update
        ctx.fillText(`ORDER ID: ${uniqueId}`, 192, 85);

        ctx.font = '18px Courier';
        ctx.fillText(studentName.toUpperCase(), 192, 130);

        // ... rest of your Bluetooth logic stays the same ...

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const bytes = new Uint8Array((canvas.width * canvas.height) / 8);

        // 1-Bit conversion
        for (let i = 0; i < imgData.data.length; i += 4) {
          const avg = (imgData.data[i] + imgData.data[i + 1] + imgData.data[i + 2]) / 3;
          const pixelIdx = i / 4;
          if (avg < 128) {
            const byteIdx = Math.floor(pixelIdx / 8);
            const bitIdx = 7 - (pixelIdx % 8);
            bytes[byteIdx] |= (1 << bitIdx);
          }
        }

        const device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['0000ae30-0000-1000-8000-00805f9b34fb']
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('0000ae30-0000-1000-8000-00805f9b34fb');
        const targetChar = (await service.getCharacteristics()).find(c => c.uuid.includes('ae10'));

        // THE MAGIC PACKET FOR FUN-PRINT DEVICES
        const sendCommand = async (commandBytes) => {
          await targetChar.writeValue(new Uint8Array(commandBytes));
          await new Promise(r => setTimeout(r, 50));
        };

        // 1. Initialize & Set Speed
        await sendCommand([0x10, 0xff, 0xfe, 0x01, 0x00, 0x00, 0x00, 0x00]); // Reset
        await sendCommand([0x1d, 0x45, 0x04]); // High-density print mode

        // 2. Data Header [0x51, 0x78] + Length of payload
        // Row Width: 48 bytes (0x30). Total rows: 160 (0xA0)
        console.log("Pushing Graphics Data...");
        await sendCommand([0x51, 0x78, 0x00, 0x30, 0xa0, 0x00]);

        // 3. Stream pixel data in small Bluetooth-friendly chunks
        for (let i = 0; i < bytes.length; i += 20) {
          const chunk = bytes.slice(i, i + 20);
          await targetChar.writeValue(chunk);
          await new Promise(r => setTimeout(r, 25)); // Essential delay for the printer CPU
        }

        // 4. Force Print/Feed Command (Critical for Fun Print protocol)
        console.log("Triggering Motor...");
        await sendCommand([0x1b, 0x64, 0x02]); // Print and feed 2 lines
        await sendCommand([0x1d, 0x0c]);       // Final form feed

        console.log("Print process finished successfully.");
        await new Promise(r => setTimeout(r, 2000));
        await server.disconnect();
        return { success: true };

      } catch (err) {
        console.error("Fun Print Protocol Error:", err);
        return { success: false, message: err.message };
      }
    },
    deleteAnnouncement: async (id) => {
      // 1. Identify who is trying to delete
      const adminId = user?.user_id || user?.id;

      // 2. Pass adminId as a query parameter (common for DELETE requests)
      const r = await api(`/api/announcements/${id}?adminId=${adminId}`, 'DELETE');

      if (r.ok) {
        // 3. UI Sync: Filter out the deleted item from state immediately
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        return { success: true };
      } else {
        console.error("Delete rejected by server:", r.data?.message);
        return { success: false, message: r.data?.message };
      }
    },
    addAnnouncement: async (msg, expires_at) => {
      const adminId = user?.user_id || user?.id;

      // 🛡️ CRITICAL: The keys here MUST match your DB columns exactly
      const payload = {
        title: "System Announcement", // Your table has a title column (YES null, but good to have)
        content: msg,                // Matches 'content' (NO null)
        type: 'info',                // Matches your ENUM ('info', 'warning', 'urgent')
        expires_at: expires_at,      // Matches 'expires_at'
        adminId: adminId             // For your backend isAdmin check
      };

      // Pass exactly 3 arguments to your api helper: (url, method, body)
      const r = await api('/api/announcements', 'POST', payload);

      if (r.ok) {
        return { success: true, data: r.data };
      } else {
        return {
          success: false,
          message: r.data?.error || r.data?.message || "Failed to post announcement"
        };
      }
    },
    addOrder: async (orderData) => {
      const currentId = user?.id || user?.user_id;
      const payload = { ...orderData, userId: currentId };

      const r = await api('/api/orders', 'POST', payload);

      if (r.ok) {
        // 🛡️ DO NOT manually add to state here. 
        // Let the Socket 'order_created' handle it to avoid ID mismatches.
        await refreshData();
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Failed" };
    },

    processScanClaim: async (orderIds, adminId) => {
      const normalizedScannedIds = Array.isArray(orderIds)
        ? orderIds.map(id => String(id))
        : [String(orderIds)];

      const response = await api('/api/orders/scan-claim', 'POST', {
        orderIds: normalizedScannedIds,
        adminId
      });

      if (response.ok) {
        // 🛡️ ATOMIC UPDATE: We must use the 'o.id' strictly.
        setOrders(prev => prev.map(o => {
          const isTarget = normalizedScannedIds.includes(String(o.id));
          if (isTarget) {
            return { ...o, status: 'CLAIMED' };
          }
          return o;
        }));

        // Give the DB a moment to finish the write, then sync everything.
        setTimeout(() => refreshData(), 800);

        // Update Inventory UI snappily
        setItems(prevItems => prevItems.map(item => {
          const matchingOrders = orders.filter(o =>
            normalizedScannedIds.includes(String(o.id)) &&
            (String(o.item_id) === String(item.id) || o.item_name === item.name)
          );

          if (matchingOrders.length === 0) return item;

          const updatedSizes = { ...item.sizes };
          matchingOrders.forEach(order => {
            const sizeKey = order.size;
            if (updatedSizes[sizeKey] > 0) {
              updatedSizes[sizeKey] = Number(updatedSizes[sizeKey]) - 1;
            }
          });

          return { ...item, sizes: updatedSizes };
        }));

        return { success: true };
      }
      return { success: false, message: response.data?.message || "Server rejected claim" };
    },
    toggleLowStock: async (itemId) => {
      const adminId = user?.user_id || user?.id;
      const r = await api('/api/items/toggle-low-stock', 'PATCH', { itemId, adminId });

      if (r.ok) {
        setItems(prev => prev.map(item =>
          item.id === itemId
            ? { ...item, is_low_stock: !item.is_low_stock }
            : item
        ));
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Failed to toggle status" };
    },
    incrementQueue: async () => {
      const adminId = user?.id;
      const r = await api('/api/queue/increment', 'POST', { adminId });
      if (r.ok) {
        // Note: The backend emits a socket event ('queue_updated'), 
        // so your UI will update automatically via the useEffect listener!
        return { success: true };
      }
      return { success: false, error: r.data?.message || "Failed to increment" };
    },
    printAnalytics: () => {
      const history = (orders || []).filter(o => {
        const s = String(o.status || "").toUpperCase().trim();
        return ['CLAIMED', 'COMPLETED', 'DELIVERED', 'RELEASED'].includes(s);
      });

      if (history.length === 0) {
        alert("No records found with finished status.");
        return;
      }

      // Updated Headers to include "Student Name"
      const headers = "Order ID,Student Name,Student ID,Item,Size,Date,Status\n";
      const rows = history.map(o => {
        const date = o.created_at ? new Date(o.created_at).toLocaleDateString() : 'N/A';
        const cleanItem = String(o.item_name || 'Item').replace(/,/g, '');
        const cleanName = String(o.full_name || 'N/A').replace(/,/g, ''); // Added Name clean

        return `${o.id},"${cleanName}",${o.user_id},"${cleanItem}","${o.size || 'N/A'}",${date},${o.status}`;
      }).join("\n");

      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `SmartClaim_Audit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    register: async (studentData) => {
      const r = await api('/api/auth/register', 'POST', { ...studentData, adminId: user?.id });
      if (r.ok) { refreshData(); return { success: true }; }
      return { success: false, message: r.data?.message || "Registration failed" };
    },
    addItem: async (itemData) => {
      const payload = { ...itemData, adminId: user?.id };
      const r = await api('/api/items', 'POST', payload);
      if (r.ok) { refreshData(); return { success: true }; }
      return { success: false, message: r.data?.message };
    },
    updateStock: async (itemId, size, delta) => {
      const r = await api('/api/items/update-stock', 'PATCH', { itemId, size, delta, adminId: user?.id });
      if (r.ok) { refreshData(); return true; }
      return false;
    },
    deleteItem: async (id) => {
      // 1. Identify admin
      const adminId = user?.user_id || user?.id;

      // 2. API Call
      const r = await api(`/api/items/${id}?adminId=${adminId}`, 'DELETE');

      if (r.ok) {
        // 3. Update local state immediately for UI snap
        setItems(prev => prev.filter(item => item.id !== id));
        return { success: true };
      } else {
        console.error("Delete failed:", r.data?.message);
        alert(r.data?.message || "Failed to delete item from database.");
        return { success: false, message: r.data?.message };
      }
    },
    processScanClaim: async (orderIds, adminId) => {
      // Ensure all IDs are treated as strings for comparison
      const normalizedScannedIds = Array.isArray(orderIds)
        ? orderIds.map(id => String(id))
        : [String(orderIds)];

      const response = await api('/api/orders/scan-claim', 'POST', {
        orderIds: normalizedScannedIds,
        adminId
      });

      if (response.ok) {
        // 1. OPTIMISTIC UPDATE: Use loose equality (==) or String conversion
        setOrders(prev => prev.map(o =>
          normalizedScannedIds.includes(String(o.id))
            ? { ...o, status: 'CLAIMED' }
            : o
        ));

        // 2. INCREASE DELAY: Give the DB 1 second to breathe before refreshing
        setTimeout(() => refreshData(), 1000);

        // 3. STOCK UPDATE 
        setItems(prevItems => {
          return prevItems.map(item => {
            const matchingOrders = orders.filter(o =>
              normalizedScannedIds.includes(String(o.id)) &&
              (o.item_id === item.id || o.item_name === item.name)
            );

            if (matchingOrders.length === 0) return item;

            const updatedSizes = { ...item.sizes };
            matchingOrders.forEach(order => {
              const sizeKey = order.size;
              if (updatedSizes[sizeKey] !== undefined && updatedSizes[sizeKey] > 0) {
                updatedSizes[sizeKey] = Number(updatedSizes[sizeKey]) - 1;
              }
            });

            // 🛡️ THE FIX: Explicitly return the existing is_low_stock status
            return {
              ...item,
              sizes: updatedSizes,
              is_low_stock: item.is_low_stock
            };
          });
        });

        return { success: true };
      }
      return { success: false, message: response.data?.message || "Server rejected claim" };
    },
    submitReceipt: async (orderId, referenceNumber) => {
      const currentId = user?.id || user?.user_id; // Get the ID
      const response = await api('/api/orders/status-update', 'PATCH', {
        ids: [orderId],
        status: 'AWAITING_VERIFICATION',
        receipt_url: referenceNumber,
        userId: currentId // 🛡️ Add this so the middleware sees it!
      });
      if (response.ok) { refreshData(); return { success: true }; }
      return { success: false, error: 'Failed to submit reference' };
    },
    updateOrderStatusBulk: async (ids, status, receipt_url = null) => {
      const r = await api('/api/orders/status-update', 'PATCH', {
        ids,
        status,
        receipt_url,
        adminId: user?.id
      });

      if (r.ok) {
        // Manually update local state so the counter drops instantly
        setOrders(prev => prev.map(o =>
          ids.includes(o.id) ? { ...o, status, receipt_url: receipt_url || o.receipt_url } : o
        ));
        return { success: true };
      }
      return { success: false, message: r.data?.message };
    },
    toggleOfficeStatus: async (nextStatus, password) => {
      const r = await api('/api/admin/system-status', 'PATCH', {
        status: nextStatus,
        password,
        adminId: user?.id
      });
      if (r.ok) {
        setOfficeStatus(nextStatus);
        return { success: true };
      }
      return { success: false, error: r.data?.message || "Unauthorized" };
    }
  };

  return (
    <AppContext.Provider value={{
      user, users, items, api, announcements, orders, officeStatus, currentQueue, loading, isAutoSchedule, privateAlert,
      setUser, refreshData, ...actions
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);