import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const AppContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_BASE_URL, { transports: ['websocket'] });

export const AppProvider = ({ children }) => {
  // --- STATE ---
  const [user, setUserState] = useState(() => {
    const saved = localStorage.getItem('app_user');
    try { return saved ? JSON.parse(saved) : null; } catch (e) { return null; }
  });

  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [officeStatus, setOfficeStatus] = useState('OPEN');
  const [loading, setLoading] = useState(false);
  const [privateAlert, setPrivateAlert] = useState(null);

  // --- HELPERS ---
  const setUser = (userData) => {
    if (userData) {
      localStorage.setItem('app_user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('app_user');
      localStorage.removeItem('token');
    }
    setUserState(userData);
  };

  const api = async (url, method = 'GET', body = null) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 15000);
    try {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };
      if (body) options.body = JSON.stringify(body);
      const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, options);
      clearTimeout(id);
      const data = await response.json();
      return { ok: response.ok, data, status: response.status };
    } catch (err) {
      clearTimeout(id);
      return { ok: false, data: { message: "Server timeout/offline" } };
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
      is_verified: Number(u.is_verified) === 1
    };
  }, []);

  // --- CORE DATA SYNC ---
  const refreshData = useCallback(async () => {
    const currentId = user?.id || user?.user_id;
    if (!currentId) return;

    setLoading(true);
    try {
      let fetchedUsers = [];
      if (user.role?.toLowerCase() === 'admin') {
        const uRes = await api(`/api/admin/users?adminId=${currentId}`);
        if (uRes.ok && Array.isArray(uRes.data)) {
          fetchedUsers = uRes.data.map(normalizeUser);
          setUsers(fetchedUsers);
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
        // Enrichment: Match User Names to Orders locally
        const enriched = ordersRes.data.map(order => {
          const student = fetchedUsers.find(u => String(u.id) === String(order.user_id || order.userId));
          return {
            ...order,
            full_name: order.full_name || student?.name || "Guest Student"
          };
        });
        setOrders(enriched);
      }
    } catch (err) {
      console.error("Refresh Failure:", err);
    } finally {
      setLoading(false);
    }
  }, [user, normalizeUser]);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    if (!user?.id) return;

    const events = {
      office_status_updated: setOfficeStatus,
      order_created: (n) => setOrders(prev => prev.some(o => String(o.id) === String(n.id)) ? prev : [n, ...prev]),
      inventory_updated: (d) => setItems(prev => prev.map(i => i.id === d.itemId ? { ...i, ...d } : i)),
      order_updated: (d) => {
        setOrders(prev => prev.map(o => {
          const targetIds = Array.isArray(d.ids) ? d.ids.map(id => String(id)) : [String(d.id || d.orderId)];
          if (targetIds.includes(String(o.id))) {
            return { ...o, ...d, status: String(d.status || o.status).toUpperCase().trim() };
          }
          return o;
        }));
      }
    };

    Object.entries(events).forEach(([e, f]) => socket.on(e, f));
    return () => Object.entries(events).forEach(([e, f]) => socket.off(e, f));
  }, [user?.id]);

  // --- ACTIONS ---
  const actions = {
    // --- AUTHENTICATION ---
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

    requestOTP: async (targetEmail) => {
      return await api('/api/auth/request-otp', 'POST', {
        email: targetEmail,
        userId: user?.id
      });
    },

    verifyOTP: async (otp, payload = {}) => {
      const currentId = user?.id || user?.user_id;
      const r = await api('/api/auth/verify-otp', 'POST', {
        otp: String(otp).trim(),
        ...payload,
        userId: currentId
      });
      if (r.ok) {
        if (r.data && r.data.user) setUser(normalizeUser(r.data.user));
        else await refreshData();
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Verification failed" };
    },

    // --- ADMIN / USER MANAGEMENT ---
    promoteUser: async (targetId, nextRole) => {
      const adminId = user?.user_id || user?.id;
      const r = await api('/api/admin/users/promote', 'PATCH', {
        targetUserId: String(targetId),
        adminId,
        newRole: nextRole
      });
      if (r.ok) {
        setUsers(prev => prev.map(u => (u.id === targetId ? { ...u, role: nextRole } : u)));
        return { success: true };
      }
      return { success: false };
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

    // --- INVENTORY & ITEMS ---
    addItem: async (itemData) => {
      const r = await api('/api/items', 'POST', { ...itemData, adminId: user?.id });
      if (r.ok) { refreshData(); return { success: true }; }
      return { success: false, message: r.data?.message };
    },

    deleteItem: async (id) => {
      const adminId = user?.user_id || user?.id;
      const r = await api(`/api/items/${id}?adminId=${adminId}`, 'DELETE');
      if (r.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
        return { success: true };
      }
      return { success: false };
    },

    toggleLowStock: async (itemId) => {
      const adminId = user?.user_id || user?.id;
      const r = await api('/api/items/toggle-low-stock', 'PATCH', { itemId, adminId });
      if (r.ok) {
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, is_low_stock: !item.is_low_stock } : item));
        return { success: true };
      }
      return { success: false };
    },

    // --- ORDERS & SCANNING ---
    addOrder: async (orderData) => {
      const currentId = user?.id || user?.user_id;
      const r = await api('/api/orders', 'POST', { ...orderData, userId: currentId });
      if (r.ok) {
        await refreshData();
        return { success: true };
      }
      return { success: false, message: r.data?.message || "Failed to place order" };
    },

    submitReceipt: async (orderId, referenceNumber) => {
      const currentId = user?.id || user?.user_id;
      const response = await api('/api/orders/status-update', 'PATCH', {
        ids: [orderId],
        status: 'AWAITING_VERIFICATION',
        receipt_url: referenceNumber,
        userId: currentId
      });
      if (response.ok) { await refreshData(); return { success: true }; }
      return { success: false };
    },

    processScanClaim: async (orderIds, adminId) => {
      const normalizedScannedIds = Array.isArray(orderIds) ? orderIds.map(id => String(id)) : [String(orderIds)];
      const response = await api('/api/orders/scan-claim', 'POST', { orderIds: normalizedScannedIds, adminId });

      if (response.ok) {
        setOrders(prevOrders => {
          const updatedOrders = prevOrders.map(o =>
            normalizedScannedIds.includes(String(o.id)) ? { ...o, status: 'CLAIMED' } : o
          );
          setItems(prevItems => prevItems.map(item => {
            const matching = updatedOrders.filter(o =>
              normalizedScannedIds.includes(String(o.id)) && (o.item_id === item.id || o.item_name === item.name)
            );
            if (matching.length === 0) return item;
            const updatedSizes = { ...item.sizes };
            matching.forEach(o => {
              const key = Object.keys(updatedSizes).find(k => k.toUpperCase() === String(o.size).toUpperCase());
              if (key && updatedSizes[key] > 0) updatedSizes[key] -= 1;
            });
            return { ...item, sizes: updatedSizes };
          }));
          return updatedOrders;
        });
        setTimeout(() => refreshData(), 1000);
        return { success: true };
      }
      return { success: false, message: response.data?.message };
    },

    updateOrderStatusBulk: async (ids, status) => {
      const r = await api('/api/orders/status-update', 'PATCH', { ids, status, adminId: user?.id });
      if (r.ok) {
        setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status } : o));
        return { success: true };
      }
      return { success: false };
    },

    // --- ANNOUNCEMENTS ---
    addAnnouncement: async (msg, expires_at) => {
      const r = await api('/api/announcements', 'POST', {
        content: msg, type: 'info', expires_at, adminId: user?.id
      });
      return r.ok ? { success: true } : { success: false };
    },

    deleteAnnouncement: async (id) => {
      const r = await api(`/api/announcements/${id}?adminId=${user?.id}`, 'DELETE');
      if (r.ok) setAnnouncements(prev => prev.filter(a => a.id !== id));
      return { success: r.ok };
    },

    // --- MISC ---
    toggleOfficeStatus: async (nextStatus, password) => {
      const r = await api('/api/admin/system-status', 'PATCH', { status: nextStatus, password, adminId: user?.id });
      if (r.ok) setOfficeStatus(nextStatus);
      return { success: r.ok };
    },

    printReceipt: async (order) => {
      console.log("Printing...", order.id);
      return { success: true };
    }
  };

  return (
    <AppContext.Provider value={{
      user, users, items, orders, announcements, officeStatus, loading,
      setUser, refreshData, ...actions
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);