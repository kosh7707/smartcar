import React from "react";
import "./CreateProjectForm.css";

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
    <div className="create-project-form">
      <input
        className="create-project-form__input"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="프로젝트 이름"
        autoFocus
        onKeyDown={(event) => event.key === "Enter" && onCreate()}
      />
      <input
        className="create-project-form__input"
        value={description}
        onChange={(event) => onDescriptionChange(event.target.value)}
        placeholder="설명 (선택)"
        onKeyDown={(event) => event.key === "Enter" && onCreate()}
      />
      <div className="create-project-form__actions">
        <button
          type="button"
          className="create-project-form__btn create-project-form__btn--ghost"
          onClick={onCancel}
        >
          취소
        </button>
        <button
          type="button"
          className="create-project-form__btn create-project-form__btn--primary"
          onClick={onCreate}
        >
          만들기
        </button>
      </div>
    </div>
  );
};
