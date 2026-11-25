import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Today from "./pages/Today";
import Wardrobe from "./pages/Wardrobe";
import AddItem from "./pages/AddItem";
import OutfitStudio from "./pages/OutfitStudio";
import Saved from "./pages/Saved";
import History from "./pages/History";
import Insights from "./pages/Insights";
import NotFound from "./pages/NotFound";
import { Login, Register } from "./pages/AuthPages";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<Today />} />
        <Route path="wardrobe" element={<Wardrobe />} />
        <Route path="add" element={<AddItem />} />
        <Route path="studio" element={<OutfitStudio />} />
        <Route path="saved" element={<Saved />} />
        <Route path="history" element={<History />} />
        <Route path="insights" element={<Insights />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Route>
    </Routes>
  );
}
