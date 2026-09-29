import React from "react";

const Sidebar = ({
  documents,
  activeDocumentId,
  onSelectDocument,
  onNewDocument,
  onDeleteDocument,
}) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Documents</h3>

        <button className="new-document-btn" onClick={onNewDocument}>
          + New
        </button>
      </div>

      <div className="document-list">
        {documents.map((doc) => (
          <div
            className={
              doc.id === activeDocumentId
                ? "document-item active"
                : "document-item"
            }
            key={doc.id}
          >
            <button
              className="document-select-btn"
              onClick={() => onSelectDocument(doc.id)}
            >
              <span>📄</span>
              {doc.title}
            </button>

            <button
              className="doc-del-btn"
              onClick={() => onDeleteDocument(doc.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};
export default Sidebar;
