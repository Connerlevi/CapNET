import React from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "./popup.css";

const el = document.getElementById("root");
if (!el) {
  console.error("CapNet Popup: root element not found");
} else {
  createRoot(el).render(<Popup />);
}
