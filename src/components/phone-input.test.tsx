import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { PhoneInput } from "./phone-input";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <>
      <PhoneInput id="phone" value={value} onChange={setValue} />
      <output data-testid="stored">{value}</output>
    </>
  );
}

describe("<PhoneInput>", () => {
  it("stores a local number as +20…", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "01011112222" } });
    expect(screen.getByTestId("stored").textContent).toBe("+201011112222");
    expect(screen.getByText("Saved as +201011112222")).toBeInTheDocument();
  });

  it("stores a Saudi number as +966… when the picker is set to SA", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Country code" }), { target: { value: "SA" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "0501234567" } });
    expect(screen.getByTestId("stored").textContent).toBe("+966501234567");
  });

  it("passes the raw text through while the number is incomplete", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "0101" } });
    expect(screen.getByTestId("stored").textContent).toBe("0101");
  });
});
