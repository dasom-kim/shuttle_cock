import React from 'react';

interface ToggleProps {
    filter: { go: boolean; leave: boolean };
    setFilter: React.Dispatch<React.SetStateAction<{ go: boolean; leave: boolean }>>;
}

const Toggle: React.FC<ToggleProps> = ({ filter, setFilter }) => {
    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: 'white',
            padding: '5px',
            borderRadius: '30px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: '5px'
        }}>
            {/* 출근 토글 버튼 */}
            <button
                onClick={() => setFilter(prev => ({ ...prev, go: !prev.go }))}
                style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '25px',
                    backgroundColor: filter.go ? '#8B5CF6' : 'transparent',
                    color: filter.go ? 'white' : '#555',
                    fontWeight: filter.go ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                출근
            </button>

            {/* 퇴근 토글 버튼 */}
            <button
                onClick={() => setFilter(prev => ({ ...prev, leave: !prev.leave }))}
                style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '25px',
                    backgroundColor: filter.leave ? '#8B5CF6' : 'transparent',
                    color: filter.leave ? 'white' : '#555',
                    fontWeight: filter.leave ? 'bold' : 'normal',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                퇴근
            </button>
        </div>
    );
};

export default Toggle;