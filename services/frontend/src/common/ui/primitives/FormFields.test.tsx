import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { InputField } from "./InputField";
import { TextareaField } from "./TextareaField";
import { SelectField } from "./SelectField";
import { CheckboxField } from "./CheckboxField";
import { RadioGroupField } from "./RadioGroupField";
import { SwitchField } from "./SwitchField";

describe("InputField", () => {
  it("renders label + hint + value and forwards onChange", () => {
    const onChange = vi.fn();
    render(
      <InputField
        label="Username"
        name="username"
        value="admin"
        onChange={onChange}
        hint="At least 3 characters"
      />,
    );
    expect(screen.getByLabelText("Username")).toHaveValue("admin");
    expect(screen.getByText("At least 3 characters")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "kosh" } });
    expect(onChange).toHaveBeenCalledWith("kosh", expect.anything());
  });

  it("surfaces error state and marks aria-invalid", () => {
    render(
      <InputField label="Email" name="email" value="" onChange={vi.fn()} error="Required" />,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("TextareaField", () => {
  it("renders and forwards onChange", () => {
    const onChange = vi.fn();
    render(
      <TextareaField label="Notes" name="notes" value="hello" onChange={onChange} rows={3} />,
    );
    const ta = screen.getByLabelText("Notes") as HTMLTextAreaElement;
    expect(ta.value).toBe("hello");
    expect(ta.rows).toBe(3);
    fireEvent.change(ta, { target: { value: "world" } });
    expect(onChange).toHaveBeenCalledWith("world", expect.anything());
  });
});

describe("SelectField", () => {
  it("renders label and trigger with current value", () => {
    render(
      <SelectField
        label="Severity"
        name="sev"
        value="high"
        onValueChange={vi.fn()}
        options={[
          { value: "low", label: "Low" },
          { value: "high", label: "High" },
        ]}
      />,
    );
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Severity" })).toHaveTextContent("High");
  });

  it("renders error state", () => {
    render(
      <SelectField
        label="Severity"
        name="sev"
        value=""
        onValueChange={vi.fn()}
        options={[{ value: "x", label: "X" }]}
        error="Pick one"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Pick one");
  });
});

describe("CheckboxField", () => {
  it("toggles via click and calls onCheckedChange", () => {
    const Controlled: React.FC = () => {
      const [checked, setChecked] = useState(false);
      return (
        <CheckboxField
          label="Agree"
          name="agree"
          checked={checked}
          onCheckedChange={(v) => setChecked(v)}
        />
      );
    };
    render(<Controlled />);
    const input = screen.getByLabelText("Agree") as HTMLInputElement;
    expect(input.checked).toBe(false);
    fireEvent.click(input);
    expect(input.checked).toBe(true);
  });
});

describe("RadioGroupField", () => {
  it("renders group with labelled options and reports selection change", () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroupField
        label="Tier"
        name="tier"
        value="standard"
        onValueChange={onValueChange}
        options={[
          { value: "standard", label: "Standard" },
          { value: "premium", label: "Premium" },
        ]}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Tier" });
    const premium = within(group).getByLabelText(/Premium/);
    fireEvent.click(premium);
    expect(onValueChange).toHaveBeenCalledWith("premium");
  });
});

describe("SwitchField", () => {
  it("toggles with role=switch", () => {
    const Controlled: React.FC = () => {
      const [on, setOn] = useState(false);
      return (
        <SwitchField
          label="Enable"
          name="enable"
          checked={on}
          onCheckedChange={(v) => setOn(v)}
        />
      );
    };
    render(<Controlled />);
    const sw = screen.getByRole("switch", { name: "Enable" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});
