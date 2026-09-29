import React from "react";

const Sidebar = ({ documents, activeDocumentId, onSelectDocument }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Documents</h3>

        <button className="new-document-btn">+ New</button>
      </div>

      <div className="document-list">
        {documents.map((doc) => (
          <button
            key={doc.id}
            className={
              doc.id === activeDocumentId
                ? "document-item active"
                : "document-item"
            }
            onClick={() => onSelectDocument(doc.id)}
          >
            <span>📄</span>

            {doc.title}
          </button>
        ))}
      </div>
    </aside>
  );
};
export default Sidebar;
