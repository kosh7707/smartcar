import { useState } from "react";

interface UseDashboardCreateFormOptions {
  onCreateProject: (name: string, description: string) => Promise<void>;
}

export function useDashboardCreateForm({ onCreateProject }: UseDashboardCreateFormOptions) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await onCreateProject(name.trim(), desc.trim());
    setName("");
    setDesc("");
    setShowCreate(false);
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
