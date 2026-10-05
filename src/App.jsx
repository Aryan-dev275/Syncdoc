import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Editor from "../components/Editor/Editor";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Editor />} />

        <Route path="/document/:documentId" element={<Editor />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
