import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installSessionGuard } from "@/lib/sessionGuard";

installSessionGuard();

createRoot(document.getElementById("root")!).render(<App />);
