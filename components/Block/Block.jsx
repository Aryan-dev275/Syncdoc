const Block = ({ block, onChange, onDelete }) => {
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

      <button className="delete-btn" onClick={() => onDelete(block.id)}>
        Delete
      </button>
    </div>
  );
};

export default Block;
