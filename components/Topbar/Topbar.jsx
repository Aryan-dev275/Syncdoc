import React from "react";
import "../Topbar/topbar.css";

const Topbar = ({ status }) => {
  return (
    <header className="topbar">
      <h2 className="app-name">SyncDoc</h2>
      <span className="save-status">{status}</span>
    </header>
  );
};

export default Topbar;
