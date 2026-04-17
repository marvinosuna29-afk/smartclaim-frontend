// Version 1.2.3 Rollback
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const AppContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://smartclaim-backend.onrender.com';
const socket = io(API_BASE_URL, { transports: ['websocket'] });
const DISCORD_RECEIPT_WEBHOOK = import.meta.env.VITE_DISCORD_RECEIPT_WEBHOOK;

export const AppProvider = ({ children }) => {
  // --- 1. BASE STATE ---
  const [user, setUserState] = useState(() => {
    const saved = localStorage.getItem('app_user');
    try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]); // Start fresh every time
  const [announcements, setAnnouncements] = useState([]);
  const [officeStatus, setOfficeStatus] = useState('OPEN');
  const [loading, setLoading] = useState(false);
  const [privateAlert, setPrivateAlert] = useState(null);
  const [currentServingId, setCurrentServingId] = useState(() => {
    return localStorage.getItem('app_serving_id') || null;
  });

  // --- 2. STABLE PRIMITIVES ---
  const stableUserId = useMemo(() => (user?.id || user?.user_id ? String(user.id || user.user_id) : null), [user?.id, user?.user_id]);
  const stableRole = useMemo(() => (user?.role ? String(user.role).toLowerCase() : 'student'), [user?.role]);

  // --- 3. HELPERS & SYNC ---
  const api = useCallback(async (url, method = 'GET', body = null) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };
      if (body) options.body = JSON.stringify(body);
      const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, options);
      clearTimeout(timeoutId);
      const data = await response.json();
      return { ok: response.ok, data, status: response.status };
    } catch (err) {
      clearTimeout(timeoutId);
      return { ok: false, data: { message: "Server timeout/offline" } };
    }
  }, []);

  const normalizeUser = useCallback((u) => {
    if (!u) return null;
    const actualId = String(u.user_id || u.id || "");
    return {
      ...u,
      id: actualId,
      user_id: actualId,
      name: u.full_name || u.name || "Unknown User",
      role: u.role?.toLowerCase() || 'student',
      is_verified: Number(u.is_verified) === 1
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!stableUserId) return;
    // We removed setLoading(true) from here to stop the flickering
    try {
      let fetchedUsers = [];
      if (stableRole === 'admin') {
        const uRes = await api(`/api/admin/users?adminId=${stableUserId}`);
        if (uRes.ok && Array.isArray(uRes.data)) {
          fetchedUsers = uRes.data.map(normalizeUser);
          setUsers(prev => JSON.stringify(prev) === JSON.stringify(fetchedUsers) ? prev : fetchedUsers);
        }
      }

      const [itemsRes, annRes, ordersRes] = await Promise.all([
        api('/api/items'),
        api('/api/announcements'),
        api('/api/orders')
      ]);

      if (itemsRes.ok) setItems(itemsRes.data);
      if (annRes.ok) setAnnouncements(annRes.data);

      if (ordersRes.ok) {
        const rawOrders = Array.isArray(ordersRes.data) ? ordersRes.data : [];
        if (rawOrders.length === 0) {
          setOrders([]);
        } else {
          const enriched = rawOrders.map(order => {
            const student = fetchedUsers.find(u => String(u.id) === String(order.user_id || order.userId));
            return {
              ...order,
              status: (order.status || 'PENDING').toUpperCase().trim(),
              full_name: order.full_name || student?.name || "Guest Student"
            };
          });
          setOrders(enriched);
        }
      }
    } catch (err) {
      console.error("Refresh Failure:", err);
    } finally {
      setLoading(false);
    }
  }, [stableUserId, stableRole, normalizeUser, api]);

  // 🛡️ STABILITY LAYER: Prevent "l is not a function" minification errors
  const refreshDataRef = React.useRef(refreshData);

  // Keep the ref updated with the latest version of the function logic
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  const refreshUser = useCallback(async () => {
    if (!stableUserId) return;
    const r = await api(`/api/auth/user/${stableUserId}`);
    if (r.ok && r.data) {
      const newUser = normalizeUser(r.data);
      setUserState(prev => JSON.stringify(prev) === JSON.stringify(newUser) ? prev : newUser);
    }
  }, [stableUserId, normalizeUser, api]);

  // --- 4. ACTIONS ---
  const actions = useMemo(() => {
    const updateStockLogic = async (itemId, size = 'default', delta = 0) => {
      const r = await api('/api/items/update-stock', 'PATCH', { itemId, size, delta, adminId: stableUserId });
      if (r.ok) {
        setItems(prev => prev.map(item => String(item.id) === String(itemId) ? { ...item, sizes: r.data.sizes } : item));
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Stock update failed" };
    };

    return {
      // 🚀 Use the Ref to ensure these never change memory addresses
      refreshOrders: () => refreshDataRef.current(),
      fetchOrders: () => refreshDataRef.current(),
      syncStats: () => refreshDataRef.current(),
      fetchStats: () => refreshDataRef.current(),
      refreshData: () => refreshDataRef.current(),

      setUser: (userData) => {
        if (userData) {
          localStorage.setItem('app_user', JSON.stringify(userData));
        } else {
          localStorage.removeItem('app_user');
          localStorage.removeItem('token');
        }
        setUserState(userData);
      },
      register: async (studentData) => {
        const r = await api('/api/auth/register', 'POST', studentData);
        if (r.ok) {
          const uRes = await api(`/api/admin/users?adminId=${stableUserId}`);
          if (uRes.ok && Array.isArray(uRes.data)) setUsers(uRes.data.map(normalizeUser));
          return { success: true };
        }
        return { success: false, message: r.data?.message || "Registration failed" };
      },
      login: async (id, password) => {
        const r = await api('/api/auth/login', 'POST', { id, password });
        if (r.ok) {
          localStorage.setItem('token', r.data.token);
          const normalized = normalizeUser(r.data.user);
          if (normalized) {
            localStorage.setItem('app_user', JSON.stringify(normalized));
            setUserState(normalized);
          }
          return { success: true };
        }
        return { success: false, message: r.data.message };
      },
      logout: () => {
        localStorage.clear();
        setUserState(null);
        window.location.href = '/login';
      },
      updateProfile: async (formData) => {
        const r = await api('/api/users/update-profile', 'PUT', {
          user_id: stableUserId,
          full_name: formData.full_name,
          email: formData.email
        });

        if (r.ok) {
          await refreshUser(); // This updates the global user state with the new name
          return { success: true };
        }
        return { success: false, message: r.data?.message || "Update failed" };
      },
      requestOTP: async (targetEmail) => {
        return await api('/api/auth/request-otp', 'POST', { email: targetEmail, userId: stableUserId });
      },
      unlinkDiscord: async () => {
        const r = await api('/api/auth/discord/unlink', 'POST', { userId: stableUserId });
        if (r.ok) { await refreshUser(); return { success: true }; }
        return { success: false, message: r.data?.message || "Failed to unlink" };
      },
      verifyOTP: async (otp, payload = {}) => {
        const r = await api('/api/auth/verify-otp', 'POST', { otp: String(otp).trim(), ...payload, userId: stableUserId });
        if (r.ok) {
          if (r.data?.user) {
            const normalized = normalizeUser(r.data.user);
            localStorage.setItem('app_user', JSON.stringify(normalized));
            setUserState(normalized);
          } else { refreshDataRef.current(); }
          return { success: true };
        }
        return { success: false, message: r.data?.message || "Verification failed" };
      },
      promoteUser: async (targetId, nextRole) => {
        const r = await api('/api/admin/users/promote', 'PATCH', { targetUserId: String(targetId), adminId: stableUserId, newRole: nextRole });
        if (r.ok) {
          setUsers(prev => prev.map(u => (u.id === targetId ? { ...u, role: nextRole } : u)));
          return { success: true };
        }
        return { success: false };
      },
      deleteUser: async (targetUserId) => {
        if (!window.confirm("Delete this user?")) return;
        const r = await api(`/api/admin/users/${targetUserId}?adminId=${stableUserId}`, 'DELETE');
        if (r.ok) { setUsers(prev => prev.filter(u => u.id !== targetUserId)); return { success: true }; }
        return { success: false };
      },
      addItem: async (itemData) => {
        const r = await api('/api/items', 'POST', { ...itemData, adminId: stableUserId });
        if (r.ok) { setItems(prev => [...prev, (r.data.item || r.data)]); return { success: true }; }
        return { success: false, message: r.data?.message };
      },
      updateItemImage: async (itemId, base64Image) => {
        // Optimistic UI update
        setItems(prev => prev.map(item =>
          String(item.id) === String(itemId) ? { ...item, image_url: base64Image } : item
        ));

        const r = await api(`/api/items/${itemId}/image`, 'PUT', {
          image_url: base64Image,
          adminId: stableUserId
        });

        if (!r.ok) {
          console.error("Image Sync Failed");
          return { success: false };
        }
        return { success: true };
      },
      deleteItem: async (id) => {
        const r = await api(`/api/items/${id}?adminId=${stableUserId}`, 'DELETE');
        if (r.ok) { setItems(prev => prev.filter(item => item.id !== id)); return { success: true }; }
        return { success: false };
      },
      updateItemStock: updateStockLogic,
      updateStock: updateStockLogic,
      toggleLowStock: async (itemId) => {
        const r = await api('/api/items/toggle-low-stock', 'PATCH', { itemId, adminId: stableUserId });
        if (r.ok) {
          setItems(prev => prev.map(item => item.id === itemId ? { ...item, is_low_stock: !item.is_low_stock } : item));
          return { success: true };
        }
        return { success: false };
      },
      addOrder: async (orderData) => {
        const r = await api('/api/orders', 'POST', { ...orderData, userId: stableUserId });
        if (r.ok) {
          let sO = r.data.order || r.data;
          sO = { ...sO, user_id: sO.user_id || stableUserId, status: (sO.status || 'PENDING').toUpperCase() };
          setOrders(prev => prev.some(o => String(o.id) === String(sO.id)) ? prev : [sO, ...prev]);

          // 🚀 SYNC FIX: Immediately pull new MySQL IDs to prevent "Submission Failed"
          await refreshDataRef.current();

          return { success: true, orderId: sO.id };
        }
        return { success: false, message: r.data?.message || "Failed" };
      },
      submitReceipt: async (id, referenceNumber) => {
        if (!id) return { success: false, error: "Order ID is missing." };

        try {
          const res = await api('/api/orders/status-update', 'POST', {
            ids: [id], // Wrapped in array for backend compatibility
            status: 'AWAITING_VERIFICATION',
            receipt_url: referenceNumber,
            userId: stableUserId
          });

          // Check if response exists and was successful
          if (res && (res.ok || res.success)) {
            await refreshDataRef.current(); // Sync UI with DB
            return { success: true };
          }
          return { success: false, error: res?.data?.message || "Server rejected update" };
        } catch (err) {
          console.error("SubmitReceipt Error:", err);
          return { success: false, error: "Connection issue." };
        }
      },
      processScanClaim: async (orderIds, adminId) => {
        const normalizedIds = Array.isArray(orderIds) ? orderIds.map(id => String(id)) : [String(orderIds)];
        const res = await api('/api/orders/scan-claim', 'POST', { orderIds: normalizedIds, adminId });
        if (res.ok) {
          setOrders(prev => prev.map(o => normalizedIds.includes(String(o.id)) ? { ...o, status: 'CLAIMED' } : o));
          setTimeout(() => refreshData(), 1000);
          return { success: true };
        }
        return { success: false };
      },
      incrementQueue: async (adminId) => {
        const r = await api('/api/queue/increment', 'POST', { adminId });
        return r.ok ? { success: true, nextId: r.data.currentNumber } : { success: false };
      },
      updateOrderStatusBulk: async (ids, status) => {
        const normalizedIds = Array.isArray(ids) ? ids.map(id => String(id)) : [String(ids)];
        const upperStatus = status.toUpperCase();
        const r = await api('/api/orders/status-update', 'POST', { ids: normalizedIds, status: upperStatus, adminId: stableUserId });
        if (r.ok) {
          setOrders(prev => prev.map(o => normalizedIds.includes(String(o.id)) ? { ...o, status: upperStatus } : o));
          setTimeout(() => refreshData(), 500);
          return { success: true };
        }
        return { success: false, error: r.data?.message || "Server Error" };
      },
      printReceipt: async (order) => {
        if (!order) return;

        console.log("🔄 Triggering Manual Receipt Sync...");

        const res = await api('/api/orders/print-manual', 'POST', {
          orderId: order.id,
          adminId: stableUserId // This uses your logged-in Admin ID
        });

        if (res.ok) {
          console.log("✅ Print signal sent to Discord!");
        } else {
          console.error("❌ Print signal failed:", res.data?.message);
        }
      },
      addAnnouncement: async (annData) => {
        const r = await api('/api/announcements', 'POST', { ...annData, adminId: stableUserId });

        if (r.ok) {
          // 🚀 THE FIX: Extract the new announcement from the response
          // Your backend returns { success: true, announcement: ann }
          const newAnn = r.data.announcement || r.data;

          // Add it to the top of the list immediately
          setAnnouncements(prev => [newAnn, ...prev]);

          return { success: true };
        }
        return { success: false, message: r.data?.message };
      },
      deleteAnnouncement: async (id) => {
        const r = await api(`/api/announcements/${id}?adminId=${stableUserId}`, 'DELETE');
        if (r.ok) setAnnouncements(prev => prev.filter(a => a.id !== id));
        return { success: r.ok };
      },
      toggleOfficeStatus: async (nextStatus, password) => {
        const r = await api('/api/admin/system-status', 'PATCH', { status: nextStatus, password, adminId: stableUserId });
        if (r.ok) setOfficeStatus(nextStatus);
        return { success: r.ok };
      }
    };
  }, [stableUserId, api, normalizeUser]);

  // --- 5. DERIVED STATE ---
  const currentQueue = useMemo(() => orders.filter(o => !['CLAIMED', 'CANCELLED'].includes(o.status?.toUpperCase())).length, [orders]);
  const myOrders = useMemo(() => {
    if (!stableUserId) return [];
    return orders.filter(o => String(o.user_id || o.userId || o.studentId) === stableUserId);
  }, [orders, stableUserId]);
  const readyOrders = useMemo(() => {
    if (!stableUserId) return [];
    return orders.filter(o => String(o.user_id || o.userId) === stableUserId && o.status?.toUpperCase() === 'READY');
  }, [orders, stableUserId]);

  // --- 6. EFFECTS ---
  useEffect(() => { if (currentServingId) localStorage.setItem('app_serving_id', String(currentServingId)); }, [currentServingId]);

  // SOCKETS
  useEffect(() => {
    if (!stableUserId) return;
    const handleQueue = (d) => setCurrentServingId(String(d.currentNumber || d.nextId || "0"));
    const handleOrderUpdated = (d) => {
      setOrders(prev => prev.map(o => {
        const targets = Array.isArray(d.ids) ? d.ids.map(id => String(id)) : [String(d.id || d.orderId)];
        return targets.includes(String(o.id)) ? { ...o, ...d, status: (d.status || o.status).toUpperCase() } : o;
      }));
    };
    socket.on('queue_updated', handleQueue);
    socket.on('order_updated', handleOrderUpdated);
    socket.on('office_status_updated', setOfficeStatus);
    return () => {
      socket.off('queue_updated'); socket.off('order_updated'); socket.off('office_status_updated');
    };
  }, [stableUserId]);

  // INITIAL FETCH
  useEffect(() => {
    if (stableUserId && items.length === 0) refreshData();
  }, [stableUserId, items.length, refreshData]);

  // 💓 BACKGROUND HEARTBEAT (New)
  // Keeps Phone and Laptop in sync even if WebSockets disconnect
  useEffect(() => {
    if (!stableUserId) return;
    const heartbeat = setInterval(() => {
      console.log("💓 Background Syncing with Aiven...");
      // Remove the 'true' here—just call the function directly
      refreshData();
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [stableUserId, refreshData]);

  return (
    <AppContext.Provider value={{
      // 1. State Variables
      user, users, items, orders, announcements, officeStatus, loading, privateAlert,
      currentQueue, readyOrders, refreshUser, currentServingId, myOrders,

      // 2. Add the API helper here so components can use it!
      api,

      // 3. Stable Function Aliases
      refreshData: () => refreshDataRef.current(),
      refreshOrders: () => refreshDataRef.current(),
      fetchOrders: () => refreshDataRef.current(),
      fetchStats: () => refreshDataRef.current(),
      syncStats: () => refreshDataRef.current(),

      // 4. Spread the rest of the actions
      ...actions
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};