import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';

const TestRouter = () => {
    return (
        <HashRouter>
            <div style={{ color: 'blue' }}>
                <h1>ROUTER WORKS</h1>
                <Routes>
                    <Route path="/" element={<h2>Home</h2>} />
                </Routes>
            </div>
        </HashRouter>
    );
};

export default TestRouter;
