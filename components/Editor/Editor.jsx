import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Block from "../Block/Block";
import "../Editor/editor.css";
import Topbar from "../Topbar/Topbar";
import Sidebar from "../Sidebar/Sidebar";

const Editor = () => {
  const navigate = useNavigate();
  const { documentId } = useParams();
  const [saveStatus, setSaveStatus] = useState("Saved");

  const [documents, setDocuments] = useState([
    {
      id: "doc-1",
      title: "Technical Specification",
      blocks: [
        {
          id: "block-1",
          type: "heading",
          content: "My Technical Specification",
        },
        {
          id: "block-2",
          type: "paragraph",
          content: "This is my document.",
        },
        {
          id: "block-3",
          type: "code",
          language: "javascript",
          content: 'const hello = "world";',
        },
      ],
    },

    {
      id: "doc-2",
      title: "Meeting Notes",
      blocks: [
        {
          id: "block-4",
          type: "heading",
          content: "Team Meeting",
        },
        {
          id: "block-5",
          type: "paragraph",
          content: "Discuss the project requirements.",
        },
      ],
    },

    {
      id: "doc-3",
      title: "Project Research",
      blocks: [
        {
          id: "block-6",
          type: "heading",
          content: "Research",
        },
        {
          id: "block-7",
          type: "paragraph",
          content: "Research notes go here.",
        },
      ],
    },
    {
      id: "doc-4",
      title: "Daily Diary",
      blocks: [
        {
          id: "block-6",
          type: "heading",
          content: "My Diary",
        },
        {
          id: "block-7",
          type: "paragraph",
          content: "Diary entry goes here",
        },
      ],
    },
  ]);

  const [activeDocumentId, setActiveDocumentId] = useState(
    documentId || "doc-1",
  );

  useEffect(() => {
    if (documentId) {
      setActiveDocumentId(documentId);
    }
  }, [documentId]);

  const documentData = documents.find((doc) => doc.id === activeDocumentId);
  if (!documentData) {
    return <div>Document not found</div>;
  }

  // EDIT BLOCK

  const handleBlockChange = (blockId, newContent) => {
    setDocuments((prevDocuments) =>
      prevDocuments.map((doc) => {
        if (doc.id !== activeDocumentId) {
          return doc;
        }

        return {
          ...doc,

          blocks: doc.blocks.map((block) => {
            if (block.id === blockId) {
              return {
                ...block,
                content: newContent,
              };
            }

            return block;
          }),
        };
      }),
    );
  };

  // CHANGE BLOCK TYPE

  const handleBlockTypeChange = (blockId, newType) => {
    setDocuments((prevDocuments) =>
      prevDocuments.map((doc) => {
        if (doc.id !== activeDocumentId) {
          return doc;
        }

        return {
          ...doc,

          blocks: doc.blocks.map((block) => {
            if (block.id === blockId) {
              return {
                ...block,
                type: newType,
              };
            }

            return block;
          }),
        };
      }),
    );
  };

  // MOVE BLOCK

  const handleMoveBlock = (blockId, direction) => {
    setDocuments((prevDocuments) =>
      prevDocuments.map((doc) => {
        if (doc.id !== activeDocumentId) {
          return doc;
        }

        const blocks = [...doc.blocks];

        const currentIndex = blocks.findIndex((block) => block.id === blockId);

        if (currentIndex === -1) {
          return doc;
        }

        let newIndex;

        if (direction === "up") {
          newIndex = currentIndex - 1;
        } else {
          newIndex = currentIndex + 1;
        }

        if (newIndex < 0 || newIndex >= blocks.length) {
          return doc;
        }

        [blocks[currentIndex], blocks[newIndex]] = [
          blocks[newIndex],
          blocks[currentIndex],
        ];

        return {
          ...doc,
          blocks,
        };
      }),
    );
  };

  // ADD BLOCK

  const handleAddBlock = () => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: "",
    };

    setDocuments((prevDocuments) =>
      prevDocuments.map((doc) => {
        if (doc.id !== activeDocumentId) {
          return doc;
        }

        return {
          ...doc,

          blocks: [...doc.blocks, newBlock],
        };
      }),
    );
  };

  // DELETE BLOCK

  const handleDelBlock = (blockId) => {
    setDocuments((prevDocuments) =>
      prevDocuments.map((doc) => {
        if (doc.id !== activeDocumentId) {
          return doc;
        }

        return {
          ...doc,

          blocks: doc.blocks.filter((block) => block.id !== blockId),
        };
      }),
    );
  };

  //New doc addition

  const handleNewDocument = () => {
    const newDocument = {
      id: crypto.randomUUID(),

      title: "Untitled Document",

      blocks: [
        {
          id: crypto.randomUUID(),
          type: "heading",
          content: "Untitled Document",
        },
        {
          id: crypto.randomUUID(),
          type: "paragraph",
          content: "",
        },
      ],
    };
    setDocuments((prevDocuments) => [...prevDocuments, newDocument]);
    setActiveDocumentId(newDocument.id);
    navigate(`/document/${newDocument.id}`);
  };

  const handleDelDocument = (documentId) => {
    setDocuments((prevDocuments) => {
      const remainingDocuments = prevDocuments.filter(
        (doc) => doc.id !== documentId,
      );

      if (remainingDocuments.length === 0) {
        return prevDocuments;
      }

      if (documentId === activeDocumentId) {
        setActiveDocumentId(remainingDocuments[0].id);
      }
      return remainingDocuments;
    });
  };

  const handleSelectDocument = (documentId) => {
    setActiveDocumentId(documentId);
    navigate(`/document/${documentId}`);
  };

  return (
    <div className="app-layout">
      <Topbar status={saveStatus} />

      <div className="main-layout">
        <Sidebar
          documents={documents}
          activeDocumentId={activeDocumentId}
          onSelectDocument={handleSelectDocument}
          onNewDocument={handleNewDocument}
          onDeleteDocument={handleDelDocument}
        />

        <main className="editor">
          <h1>{documentData.title}</h1>

          {documentData.blocks.map((block) => (
            <div className="block-wrapper" key={block.id}>
              <Block
                block={block}
                onChange={handleBlockChange}
                onDelete={handleDelBlock}
                onTypeChange={handleBlockTypeChange}
                onMove={handleMoveBlock}
              />
            </div>
          ))}

          <button className="add-block-btn" onClick={handleAddBlock}>
            + Add new block
          </button>
        </main>
      </div>
    </div>
  );
};
export default Editor;
