import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DashboardExplorerCreateFlow } from "./dashboardContracts";

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

  const createFlow: DashboardExplorerCreateFlow = {
    show: showCreate,
    name,
    description: desc,
    onToggle: () => setShowCreate((prev) => !prev),
    onNameChange: setName,
    onDescriptionChange: setDesc,
    onSubmit: handleCreate,
    onCancel: handleCancelCreate,
  };

  return {
    createFlow,
  };
}
