import React, { useState } from 'react';

interface NicknameSetupModalProps {
    isOpen: boolean;
    suggestedNickname: string;
    onSubmit: (nickname: string) => void | Promise<void>;
}

const NicknameSetupModal: React.FC<NicknameSetupModalProps> = ({
    isOpen,
    suggestedNickname,
    onSubmit
}) => {
    const [nickname, setNickname] = useState(suggestedNickname);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        if (!isOpen) return;
        setNickname(suggestedNickname);
    }, [isOpen, suggestedNickname]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            await onSubmit(nickname);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={overlayStyle}>
            <div style={contentStyle}>
                <h2 style={titleStyle}>환영해요! 닉네임을 정해 주세요</h2>
                <p style={descStyle}>
                    셔틀콕에서 사용할 닉네임이에요. 비워두면 추천 닉네임으로 저장돼요.
                </p>
                <div style={inputGroupStyle}>
                    <label style={labelStyle}>닉네임</label>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder={suggestedNickname}
                        style={inputStyle}
                        maxLength={20}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    style={submitButtonStyle(isSubmitting)}
                >
                    {isSubmitting ? '저장 중...' : '시작하기'}
                </button>
            </div>
        </div>
    );
};

const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 7000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box'
};

const contentStyle: React.CSSProperties = {
    width: 'min(440px, 100%)',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '20px',
    boxSizing: 'border-box',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.2)'
};

const titleStyle: React.CSSProperties = {
    margin: '0 0 8px',
    color: '#111827',
    fontSize: '1.15rem'
};

const descStyle: React.CSSProperties = {
    margin: '0 0 14px',
    color: '#6B7280',
    fontSize: '0.9rem',
    lineHeight: 1.4
};

const inputGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '14px'
};

const labelStyle: React.CSSProperties = {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#4B5563'
};

const inputStyle: React.CSSProperties = {
    border: '1px solid #D1D5DB',
    borderRadius: '10px',
    padding: '10px 12px',
    fontSize: '0.95rem',
    outline: 'none'
};

const submitButtonStyle = (disabled: boolean): React.CSSProperties => ({
    width: '100%',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    fontSize: '0.95rem',
    fontWeight: 700,
    padding: '11px 12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1
});

export default NicknameSetupModal;
