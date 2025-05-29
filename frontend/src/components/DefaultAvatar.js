import React from "react";

const DefaultAvatar = ({ name = "U", size = 40 }) => {
  const firstLetter = name.charAt(0).toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#0077b5",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: "bold",
      }}
    >
      {firstLetter}
    </div>
  );
};

export default DefaultAvatar;
