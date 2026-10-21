import { Link } from "react-router-dom";

export default function SupportedLink({ supported, children, ...props }) {
  if (supported === false) {
    const { to, replace, state, ...attributes } = props;
    return <span {...attributes}>{children}</span>;
  }
  return <Link {...props}>{children}</Link>;
}
