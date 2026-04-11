import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface UseDashboardCreateFormOptions {
  createProject: (name: string, description: string) => Promise<{ id: string }>;
}

export function useDashboardCreateForm({ createProject }: UseDashboardCreateFormOptions) {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const project = await createProject(name.trim(), desc.trim());
    setName("");
    setDesc("");
    setShowCreate(false);
    navigate(`/projects/${project.id}/overview`);
  };

  const handleCancelCreate = () => {
    setShowCreate(false);
    setName("");
    setDesc("");
  };

  const toggleCreate = () => setShowCreate((prev) => !prev);

  return {
    showCreate,
    name,
    desc,
    setName,
    setDesc,
    toggleCreate,
    handleCreate,
    handleCancelCreate,
  };
}
