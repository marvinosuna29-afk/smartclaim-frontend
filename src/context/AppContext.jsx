// Version 1.2.0 - Production Stability Deployment
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const AppContext = createContext();
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://smartclaim-backend.onrender.com';
const socket = io(API_BASE_URL, { transports: ['websocket'] });

export const AppProvider = ({ children }) => {
    // --- STATE ---
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

    // --- 🛡️ STABLE PRIMITIVES (The #310 Killers) ---
    // These ensure hooks depend on strings/booleans rather than shifting objects
    const stableUserId = useMemo(() => (user?.id || user?.user_id ? String(user.id || user.user_id) : null), [user?.id, user?.user_id]);
    const stableRole = useMemo(() => (user?.role ? String(user.role).toLowerCase() : 'student'), [user?.role]);

    // --- DERIVED STATE ---
    const currentQueue = useMemo(() => {
        return orders.filter(o => {
            const status = String(o.status || "").toUpperCase();
            return status !== 'CLAIMED' && status !== 'CANCELLED';
        }).length;
    }, [orders]);

    const readyOrders = useMemo(() => {
        if (!stableUserId || !orders.length) return [];
        return orders.filter(o => {
            const orderUserId = String(o.user_id || o.userId || "");
            const status = String(o.status || "").toUpperCase();
            return orderUserId === stableUserId && status === 'READY';
        });
    }, [orders, stableUserId]);

    // --- PERSISTENCE ---
    useEffect(() => {
        localStorage.setItem('app_orders', JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        if (currentServingId !== null && currentServingId !== undefined) {
            localStorage.setItem('app_serving_id', String(currentServingId));
        }
    }, [currentServingId]);

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

    // --- CORE DATA SYNC ---
    const refreshUser = useCallback(async () => {
        if (!stableUserId) return;
        const r = await api(`/api/auth/user/${stableUserId}`);
        if (r.ok && r.data) {
            const newUser = normalizeUser(r.data);
            setUserState(prev => {
                if (JSON.stringify(prev) === JSON.stringify(newUser)) return prev;
                return newUser;
            });
        }
    }, [stableUserId, normalizeUser]);

    const refreshData = useCallback(async () => {
        if (!stableUserId) return;
        setLoading(true);
        try {
            let fetchedUsers = [];
            if (stableRole === 'admin') {
                const uRes = await api(`/api/admin/users?adminId=${stableUserId}`);
                if (uRes.ok && Array.isArray(uRes.data)) {
                    fetchedUsers = uRes.data.map(normalizeUser);
                    setUsers(prev => {
                        return JSON.stringify(prev) === JSON.stringify(fetchedUsers) ? prev : fetchedUsers;
                    });
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
                    return {
                        ...order,
                        full_name: order.full_name || student?.name || "Guest Student"
                    };
                });
                setOrders(prev => {
                    return JSON.stringify(prev) === JSON.stringify(enriched) ? prev : enriched;
                });
            }
        } catch (err) {
            console.error("Refresh Failure:", err);
        } finally {
            // Small delay to prevent loading state "flicker" which triggers hook mismatches
            setTimeout(() => setLoading(false), 50);
        }
    }, [stableUserId, stableRole, normalizeUser]);

    useEffect(() => {
        if (stableUserId && items.length === 0) {
            refreshData();
        }
    }, [stableUserId, items.length, refreshData]);

    // --- SOCKET LISTENERS ---
    useEffect(() => {
        if (!stableUserId) return;

        const handleQueue = (data) => {
            const nextId = String(data.currentNumber || data.nextId || "0");
            setCurrentServingId(prev => (prev !== nextId ? nextId : prev));
        };

        const handleOrderCreated = (newOrder) => {
            setOrders(prev => {
                if (prev.some(o => String(o.id) === String(newOrder.id))) return prev;
                return [{ ...newOrder, status: (newOrder.status || 'PENDING').toUpperCase() }, ...prev];
            });
        };

        const handleOrderUpdated = (d) => {
            setOrders(prev => prev.map(o => {
                const targetIds = Array.isArray(d.ids) ? d.ids.map(id => String(id)) : [String(d.id || d.orderId)];
                if (targetIds.includes(String(o.id))) {
                    const newStatus = String(d.status || o.status).toUpperCase().trim();
                    return { ...o, ...d, status: newStatus };
                }
                return o;
            }));
        };

        socket.on('office_status_updated', setOfficeStatus);
        socket.on('queue_updated', handleQueue);
        socket.on('order_created', handleOrderCreated);
        socket.on('inventory_updated', (d) => setItems(prev => prev.map(i => i.id === d.itemId ? { ...i, ...d } : i)));
        socket.on('order_updated', handleOrderUpdated);

        return () => {
            socket.off('office_status_updated');
            socket.off('queue_updated');
            socket.off('order_created');
            socket.off('inventory_updated');
            socket.off('order_updated');
        };
    }, [stableUserId]);

    // --- ACTIONS ---
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
        requestOTP: async (targetEmail) => {
            return await api('/api/auth/request-otp', 'POST', { email: targetEmail, userId: stableUserId });
        },
        verifyOTP: async (otp, payload = {}) => {
            const r = await api('/api/auth/verify-otp', 'POST', {
                otp: String(otp).trim(),
                ...payload,
                userId: stableUserId
            });
            if (r.ok) {
                if (r.data && r.data.user) setUser(normalizeUser(r.data.user));
                else await refreshData();
                return { success: true };
            }
            return { success: false, message: r.data?.message || "Verification failed" };
        },
        promoteUser: async (targetId, nextRole) => {
            const r = await api('/api/admin/users/promote', 'PATCH', {
                targetUserId: String(targetId),
                adminId: stableUserId,
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
            const r = await api(`/api/admin/users/${targetUserId}?adminId=${stableUserId}`, 'DELETE');
            if (r.ok) {
                setUsers(prev => prev.filter(u => u.id !== targetUserId));
                return { success: true };
            }
            return { success: false };
        },
        addItem: async (itemData) => {
            const r = await api('/api/items', 'POST', { ...itemData, adminId: stableUserId });
            if (r.ok) {
                const newItem = r.data.item || r.data;
                setItems(prev => [...prev, newItem]);
                return { success: true };
            }
            return { success: false, message: r.data?.message };
        },
        deleteItem: async (id) => {
            const r = await api(`/api/items/${id}?adminId=${stableUserId}`, 'DELETE');
            if (r.ok) {
                setItems(prev => prev.filter(item => item.id !== id));
                return { success: true };
            }
            return { success: false };
        },
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
                const serverOrder = r.data.order || r.data;
                setOrders(prev => {
                    if (prev.some(o => String(o.id) === String(serverOrder.id))) return prev;
                    return [serverOrder, ...prev];
                });
                return { success: true, orderId: serverOrder.id };
            }
            return { success: false, message: r.data?.message || "Failed to place order" };
        },
        submitReceipt: async (orderId, referenceNumber) => {
            const response = await api('/api/orders/status-update', 'PATCH', {
                ids: [orderId],
                status: 'AWAITING_VERIFICATION',
                receipt_url: referenceNumber,
                userId: stableUserId
            });
            if (response.ok) { await refreshData(); return { success: true }; }
            return { success: false };
        },
        processScanClaim: async (orderIds, adminId) => {
            const normalizedIds = Array.isArray(orderIds) ? orderIds.map(id => String(id)) : [String(orderIds)];
            const response = await api('/api/orders/scan-claim', 'POST', { orderIds: normalizedIds, adminId });
            if (response.ok) {
                setOrders(prev => prev.map(order =>
                    normalizedIds.includes(String(order.id)) ? { ...order, status: 'CLAIMED' } : order
                ));
                setItems(prevItems => prevItems.map(item => {
                    const claimedForThisItem = orders.filter(o =>
                        normalizedIds.includes(String(o.id)) && (String(o.item_id) === String(item.id))
                    );
                    if (claimedForThisItem.length === 0) return item;
                    const newSizes = { ...item.sizes };
                    claimedForThisItem.forEach(o => {
                        const sizeKey = Object.keys(newSizes).find(k => o.size && k.toLowerCase() === String(o.size).toLowerCase());
                        if (sizeKey && newSizes[sizeKey] > 0) newSizes[sizeKey] -= 1;
                    });
                    return { ...item, sizes: newSizes };
                }));
                setTimeout(() => refreshData(), 1500);
                return { success: true };
            }
            return { success: false, message: response.data?.message };
        },
        incrementQueue: async (adminId) => {
            const r = await api('/api/queue/increment', 'POST', { adminId });
            return r.ok ? { success: true, nextId: r.data.currentNumber } : { success: false, message: r.data.message || "Queue Error" };
        },
        updateOrderStatusBulk: async (ids, status) => {
            const normalizedStatus = String(status).toUpperCase();
            const r = await api('/api/orders/status-update', 'PATCH', { ids, status: normalizedStatus, adminId: stableUserId });
            if (r.ok) {
                const stringIds = ids.map(id => String(id));
                setOrders(prev => prev.map(o => stringIds.includes(String(o.id)) ? { ...o, status: normalizedStatus } : o));
                return { success: true };
            }
            return { success: false };
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
        },
        printReceipt: async (order) => {
            console.log("Printing...", order.id);
            return { success: true };
        }
    };

    return (
        <AppContext.Provider value={{
            user, users, items, orders, announcements, officeStatus, loading, privateAlert,
            currentQueue, readyOrders, refreshUser, currentServingId,
            setUser, refreshData, ...actions
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => useContext(AppContext);