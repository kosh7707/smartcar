import React from "react";

interface CreateProjectFormProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCreate: () => void;
  onCancel: () => void;
}

export const CreateProjectForm: React.FC<CreateProjectFormProps> = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCreate,
  onCancel,
}) => {
  return (
    <div className="dashboard-create-inline">
      <input
        className="dashboard-create-inline__input"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="Project name"
        autoFocus
        onKeyDown={(event) => event.key === "Enter" && onCreate()}
      />
      <input
        className="dashboard-create-inline__input"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="Description (optional)"
        onKeyDown={(event) => event.key === "Enter" && onCreate()}
      />
      <div className="dashboard-create-inline__actions">
        <button
          type="button"
          className="dashboard-create-inline__btn dashboard-create-inline__btn--ghost"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="dashboard-create-inline__btn dashboard-create-inline__btn--primary"
          onClick={onCreate}
        >
          Create
        </button>
      </div>
    </div>
  );
};
