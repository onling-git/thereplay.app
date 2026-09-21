import { Link, useMatch } from "react-router-dom";
import './breadcrumbs.css';

function formatTeamName(teamSlug) {
	return teamSlug
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export default function Breadcrumbs() {
	const liveMatch = useMatch("/:teamSlug/match/:matchId/live");
	const matchReport = useMatch("/:teamSlug/match/:matchId/report");
	const currentMatch = liveMatch || matchReport;

	if (!currentMatch) return null;

	const { teamSlug } = currentMatch.params;
	const teamName = formatTeamName(teamSlug);
	const currentPage = liveMatch ? "Live Match" : "Match Report";

	return (
		<nav className="breadcrumbs" aria-label="Breadcrumb">
			<ol className="breadcrumbs-list">
				<li className="breadcrumbs-item">
					<Link className="breadcrumbs-link" to={`/${teamSlug}`}>
						{teamName}
					</Link>
				</li>
				<li className="breadcrumbs-separator" aria-hidden="true">
					/
				</li>
				<li className="breadcrumbs-item" aria-current="page">
					{currentPage}
				</li>
			</ol>
		</nav>
	);
}
