import { useState } from "react";
import Block from "./Block";
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
  return (
    <div>
      <h1>{document.title}</h1>

      {document.blocks.map((block) => {
        return (
          <div key={block?.id}>
            <Block id={block.id} block={block} onChange={handleBlockChange} />
          </div>
        );
      })}
    </div>
  );
};

export default Editor;
