// Version 1.2.2 - Production Error #310 & Scope Fix (Final)
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const AppContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://smartclaim-backend.onrender.com';
const socket = io(API_BASE_URL, { transports: ['websocket'] });

export const AppProvider = ({ children }) => {
  // --- 1. BASE STATE ---
  const [user, setUserState] = useState(() => {
    const saved = localStorage.getItem('app_user');
    try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem('app_orders');
    try { return saved ? JSON.parse(saved) : []; } catch (e) { return []; }
  });
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
    setLoading(true);
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

      if (ordersRes.ok && Array.isArray(ordersRes.data)) {
        const enriched = ordersRes.data.map(order => {
          const student = fetchedUsers.find(u => String(u.id) === String(order.user_id || order.userId));
          return { ...order, full_name: order.full_name || student?.name || "Guest Student" };
        });
        setOrders(prev => JSON.stringify(prev) === JSON.stringify(enriched) ? prev : enriched);
      }
    } catch (err) {
      console.error("Refresh Failure:", err);
    } finally {
      setTimeout(() => setLoading(false), 50);
    }
  }, [stableUserId, stableRole, normalizeUser, api]);

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
    // We define the stock logic as a local constant first to avoid circular reference crashes
    const updateStockLogic = async (itemId, size = 'default', delta = 0) => {
      const r = await api('/api/items/update-stock', 'PATCH', {
        itemId,
        size,
        delta,
        adminId: stableUserId
      });

      if (r.ok) {
        setItems(prev => prev.map(item =>
          String(item.id) === String(itemId) ? { ...item, sizes: r.data.sizes } : item
        ));
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Stock update failed" };
    };

    return {
      // Logic Aliases (Fixes production 'l is not a function' error)
      refreshOrders: refreshData,
      fetchOrders: refreshData,
      syncStats: refreshData,
      fetchStats: refreshData,

      setUser: (userData) => {
        if (userData) localStorage.setItem('app_user', JSON.stringify(userData));
        else { localStorage.removeItem('app_user'); localStorage.removeItem('token'); }
        setUserState(userData);
      },
      register: async (studentData) => {
        const r = await api('/api/auth/register', 'POST', studentData);
        if (r.ok) {
          const uRes = await api(`/api/admin/users?adminId=${stableUserId}`);
          if (uRes.ok && Array.isArray(uRes.data)) {
            setUsers(uRes.data.map(normalizeUser));
          }
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
          } else {
            refreshData();
          }
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
      deleteItem: async (id) => {
        const r = await api(`/api/items/${id}?adminId=${stableUserId}`, 'DELETE');
        if (r.ok) { setItems(prev => prev.filter(item => item.id !== id)); return { success: true }; }
        return { success: false };
      },
      // Using the local constant to point both function names to the same logic
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
          return { success: true, orderId: sO.id };
        }
        return { success: false, message: r.data?.message || "Failed" };
      },
      submitReceipt: async (id, referenceNumber) => {
        // 1. Trace the incoming data
        console.log("🛠️ Submitting Receipt for ID:", id, "Ref:", referenceNumber);

        // 2. Handle potential ID naming mismatches from the UI
        const targetId = id;

        if (!targetId) {
          console.error("❌ Submit failed: No ID provided to the function.");
          return { success: false, error: "Order ID is missing." };
        }

        try {
          const res = await api('/api/orders/status-update', 'POST', {
            ids: [targetId], // Backend expects an array
            status: 'AWAITING_VERIFICATION',
            receipt_url: referenceNumber, // We saw this is the text column in your DB
            userId: stableUserId
          });

          // 3. Robust Response Check
          // If 'api' returns the raw fetch Response, use res.ok. 
          // If it returns parsed JSON, check for a success flag.
          const isSuccess = res && (res.ok || res.success || res.status === 200);

          if (isSuccess) {
            console.log("✅ Submission Successful!");
            if (typeof refreshData === 'function') {
              await refreshData();
            }
            return { success: true };
          }

          // 4. Handle Server Rejection (e.g., 404, 500)
          const errorMsg = res?.message || "Server rejected the update.";
          console.error("⚠️ Server Error:", errorMsg);
          return { success: false, error: errorMsg };

        } catch (err) {
          // 5. Handle Network/Connection Failures
          console.error("🚨 Network/Connection Error:", err);
          return { success: false, error: "Connection issue. Please try again." };
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
        const r = await api('/api/orders/status-update', 'POST', {
          ids: normalizedIds, status: upperStatus, adminId: stableUserId
        });
        if (r.ok) {
          setOrders(prev => prev.map(o => normalizedIds.includes(String(o.id)) ? { ...o, status: upperStatus } : o));
          setTimeout(() => refreshData(), 500);
          return { success: true };
        }
        return { success: false, error: r.data?.message || "Server Error" };
      },
      printReceipt: (order) => {
        if (!order) return;
        window.print();
      },
      addAnnouncement: async (msg, expires_at) => {
        const r = await api('/api/announcements', 'POST', { content: msg, type: 'info', expires_at, adminId: stableUserId });
        return r.ok ? { success: true } : { success: false };
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
  }, [stableUserId, api, normalizeUser, refreshData, refreshUser]);

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
  useEffect(() => { localStorage.setItem('app_orders', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { if (currentServingId) localStorage.setItem('app_serving_id', String(currentServingId)); }, [currentServingId]);

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
      socket.off('queue_updated');
      socket.off('order_updated');
      socket.off('office_status_updated');
    };
  }, [stableUserId]);

  useEffect(() => {
    if (stableUserId && items.length === 0) refreshData();
  }, [stableUserId, items.length, refreshData]);

  return (
    <AppContext.Provider value={{
      user, users, items, orders, announcements, officeStatus, loading, privateAlert,
      currentQueue, readyOrders, refreshUser, currentServingId, myOrders,
      refreshOrders: refreshData,
      fetchOrders: refreshData,
      fetchStats: refreshData,
      syncStats: refreshData,
      refreshData,
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