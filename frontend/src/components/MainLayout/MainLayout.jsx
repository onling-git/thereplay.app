import { Outlet } from "react-router-dom";
import Header from "../Header/Header";
import FooterNav from "../FooterNav/FooterNav";
import ConsentAccessGate from "../CookieConsent/ConsentAccessGate";

export default function MainLayout() {
    return (
        <>
            <Header />
            <main className="page-content">
                <ConsentAccessGate><Outlet /></ConsentAccessGate>
            </main>
            <FooterNav />
        </>
    );
}