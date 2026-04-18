import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

type ToastType = 'info' | 'success' | 'error';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
    isOpen: boolean;
}

interface FeedbackContextValue {
    showToast: (message: string, type?: ToastType) => void;
    showConfirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirm, setConfirm] = useState<ConfirmState>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '확인',
        cancelText: '취소'
    });
    const toastIdRef = useRef(0);
    const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);

        window.setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, 2600);
    }, []);

    const showConfirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            confirmResolverRef.current = resolve;
            setConfirm({
                isOpen: true,
                title: options.title,
                message: options.message,
                confirmText: options.confirmText || '확인',
                cancelText: options.cancelText || '취소'
            });
        });
    }, []);

    const closeConfirm = (result: boolean) => {
        setConfirm(prev => ({ ...prev, isOpen: false }));
        if (confirmResolverRef.current) {
            confirmResolverRef.current(result);
            confirmResolverRef.current = null;
        }
    };

    const value = useMemo(() => ({ showToast, showConfirm }), [showToast, showConfirm]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}

            <div style={toastContainerStyle}>
                {toasts.map((toast) => (
                    <div key={toast.id} style={toastStyle(toast.type)}>
                        <span style={toastIconStyle(toast.type)}>{getToastIcon(toast.type)}</span>
                        <span style={toastMessageStyle}>{toast.message}</span>
                    </div>
                ))}
            </div>

            {confirm.isOpen && (
                <div style={confirmOverlayStyle}>
                    <div style={confirmCardStyle}>
                        <h3 style={confirmTitleStyle}>{confirm.title}</h3>
                        <p style={confirmMessageStyle}>{confirm.message}</p>
                        <div style={confirmButtonsStyle}>
                            <button onClick={() => closeConfirm(false)} style={confirmCancelStyle}>
                                {confirm.cancelText}
                            </button>
                            <button onClick={() => closeConfirm(true)} style={confirmSubmitStyle}>
                                {confirm.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </FeedbackContext.Provider>
    );
};

export const useFeedback = () => {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error('useFeedback must be used within FeedbackProvider');
    }
    return context;
};

const toastContainerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 18px)',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 6000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    width: 'max-content',
    maxWidth: 'calc(100% - 24px)',
    pointerEvents: 'none'
};

const toastStyle = (type: ToastType): React.CSSProperties => {
    const colors =
        type === 'success'
            ? { bg: '#EAFBF1', text: '#14532D', border: '#B7E8CA' }
            : type === 'error'
                ? { bg: '#FDECEC', text: '#9F1239', border: '#F6C2CF' }
                : { bg: '#EAF0FF', text: '#1E3A8A', border: '#C4D4FF' };

    return {
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: '18px',
        padding: '11px 13px',
        fontSize: '0.94rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        width: 'fit-content',
        maxWidth: 'min(92vw, 460px)',
        boxShadow: '0 10px 20px rgba(15, 23, 42, 0.16)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    };
};

const toastMessageStyle: React.CSSProperties = {
    lineHeight: 1.35
};

const toastIconStyle = (type: ToastType): React.CSSProperties => {
    const bg = type === 'success' ? '#16A34A' : type === 'error' ? '#E11D48' : '#2563EB';
    return {
        width: '22px',
        height: '22px',
        borderRadius: '11px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: bg,
        color: '#FFFFFF',
        fontSize: '0.82rem',
        fontWeight: 700
    };
};

const getToastIcon = (type: ToastType) => {
    if (type === 'success') return '✓';
    if (type === 'error') return '!';
    return 'i';
};

const confirmOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    zIndex: 7000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px'
};

const confirmCardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '360px',
    borderRadius: '16px',
    backgroundColor: '#FFFFFF',
    padding: '22px 20px 18px',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.25)'
};

const confirmTitleStyle: React.CSSProperties = {
    margin: 0,
    color: '#312E81',
    fontSize: '1rem'
};

const confirmMessageStyle: React.CSSProperties = {
    marginTop: '10px',
    marginBottom: '18px',
    color: '#4B5563',
    lineHeight: 1.45,
    fontSize: '0.92rem'
};

const confirmButtonsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '10px'
};

const confirmCancelStyle: React.CSSProperties = {
    flex: 1,
    border: '1px solid #E5E7EB',
    borderRadius: '10px',
    backgroundColor: '#F9FAFB',
    color: '#4B5563',
    padding: '10px 0',
    fontWeight: 700,
    cursor: 'pointer'
};

const confirmSubmitStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    borderRadius: '10px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    padding: '10px 0',
    fontWeight: 700,
    cursor: 'pointer'
};
