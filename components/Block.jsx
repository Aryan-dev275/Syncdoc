const Block = ({ block, onChange }) => {
  const handelChange = (e) => {
    onChange(block.id, e.target.value);
  };
  if (block.type === "heading") {
    return <input type="text" value={block.content} onChange={handelChange} />;
  }
  if (block.type === "paragraph") {
    return (
      <textarea type="text" value={block.content} onChange={handelChange} />
    );
  }
  if (block.type === "code") {
    return (
      <textarea type="text" value={block.content} onChange={handelChange} />
    );
  }
};

export default Block;
