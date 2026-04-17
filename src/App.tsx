// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MapPage from './pages/MapPage';
// import LoginPage from './pages/LoginPage'; // 나중에 로그인 페이지 만들면 주석 해제

const App: React.FC = () => {
  return (
      <BrowserRouter>
        <Routes>
          {/* 기본 경로(/)로 접속하면 MapPage(메인 지도)를 보여줍니다. */}
          <Route path="/" element={<MapPage />} />

          {/* 나중에 추가할 로그인 페이지 라우팅 예시 */}
          {/* <Route path="/login" element={<LoginPage />} /> */}
        </Routes>
      </BrowserRouter>
  );
};

export default App;