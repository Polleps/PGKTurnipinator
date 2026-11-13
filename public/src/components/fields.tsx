import type { JSX } from "solid-js";

/** Controlled form controls, the Solid versions of the old templates/*.js. */

interface InputProps {
  type?: "text" | "number" | "datetime-local";
  name: string;
  value: string;
  onValue: (value: string) => void;
  class: string;
  placeholder?: string;
  disabled?: boolean;
}

export const Input = (props: InputProps): JSX.Element => (
  <input
    type={props.type ?? "text"}
    name={props.name}
    class={props.class}
    value={props.value}
    onInput={(e) => props.onValue(e.currentTarget.value)}
    placeholder={props.placeholder ?? ""}
    disabled={props.disabled ?? false}
  />
);

interface CheckboxProps {
  name: string;
  checked: boolean;
  onChecked: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export const Checkbox = (props: CheckboxProps): JSX.Element => (
  <>
    <input
      type="checkbox"
      name={props.name}
      id={props.name}
      checked={props.checked}
      onInput={(e) => props.onChecked(e.currentTarget.checked)}
      disabled={props.disabled ?? false}
    />
    <label for={props.name}>{props.label}</label>
  </>
);

interface TextareaProps {
  name: string;
  value: string;
  onValue: (value: string) => void;
  class: string;
  disabled?: boolean;
  maxLength: number;
}

export const Textarea = (props: TextareaProps): JSX.Element => (
  <textarea
    name={props.name}
    class={props.class}
    value={props.value}
    onInput={(e) => props.onValue(e.currentTarget.value)}
    placeholder=""
    wrap="hard"
    disabled={props.disabled ?? false}
    cols="60"
    rows="10"
    maxLength={props.maxLength}
  />
);
