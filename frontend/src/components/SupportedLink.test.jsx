import { render, screen } from "@testing-library/react";
import SupportedLink from "./SupportedLink";
jest.mock("react-router-dom", () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));

test("foreign opponents remain visible without a navigable hub link", () => {
  render(<SupportedLink supported={false} to="/foreign">Foreign opponent</SupportedLink>);
  expect(screen.getByText("Foreign opponent").tagName).toBe("SPAN");
  expect(screen.queryByRole("link")).toBeNull();
});

test("supported clubs retain navigation", () => {
  render(<SupportedLink supported to="/supported">Supported</SupportedLink>);
  expect(screen.getByRole("link").getAttribute("href")).toBe("/supported");
});
