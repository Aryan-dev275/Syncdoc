import { useState } from "react";
import Block from "../Block/Block";
import "../Editor/editor.css";

const Editor = () => {
  const [document, setDocument] = useState({
    id: "doc-1",
    title: "SyncDoc",
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
  });
  const handleBlockChange = (blockId, newContent) => {
    setDocument((prevDocument) => ({
      ...prevDocument,
      blocks: prevDocument.blocks.map((block) => {
        if (block.id === blockId) {
          return {
            ...block,
            content: newContent,
          };
        }
        return block;
      }),
    }));
  };

  const handleAddBlock = () => {
    const newBlock = {
      id: crypto.randomUUID(),
      type: "paragraph",
      content: "",
    };
    setDocument((prevDocument) => ({
      ...prevDocument,
      blocks: [...prevDocument.blocks, newBlock],
    }));
  };

  const handleDelBlock = (blockId) => {
    setDocument((prevDocument) => ({
      ...prevDocument,
      blocks: prevDocument.blocks.filter((block) => block.id !== blockId),
    }));
  };

  return (
    <div className="editor">
      <h1>{document.title}</h1>

      {document.blocks.map((block) => (
        <div className="block-wrapper" key={block.id}>
          <Block
            block={block}
            onChange={handleBlockChange}
            onDelete={handleDelBlock}
          />
        </div>
      ))}

      <button className="add-block-btn" onClick={handleAddBlock}>
        + Add new block
      </button>
    </div>
  );
};

export default Editor;
