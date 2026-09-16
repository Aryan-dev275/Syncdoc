const Block = ({ block, onChange, onDelete, onTypeChange, onMove }) => {
  const handleChange = (e) => {
    onChange(block.id, e.target.value);
  };

  return (
    <div className="block">
      <div className="block-content">
        {block.type === "heading" && (
          <input
            className="heading-input"
            type="text"
            value={block.content}
            onChange={handleChange}
          />
        )}

        {block.type === "paragraph" && (
          <textarea
            className="paragraph-input"
            value={block.content}
            onChange={handleChange}
          />
        )}

        {block.type === "code" && (
          <textarea
            className="code-input"
            value={block.content}
            onChange={handleChange}
          />
        )}
      </div>

      <select
        value={block.type}
        onChange={(e) => onTypeChange(block.id, e.target.value)}
      >
        <option value="heading">Heading</option>
        <option value="paragraph">Paragraph</option>
        <option value="code">Code</option>
      </select>
      <button onClick={() => onMove(block.id, "up")}>↑</button>

      <button onClick={() => onMove(block.id, "down")}>↓</button>
      <button className="delete-btn" onClick={() => onDelete(block.id)}>
        Delete
      </button>
    </div>
  );
};

export default Block;
