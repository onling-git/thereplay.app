import { Outlet } from "react-router-dom";
import Header from "../Header/Header";
import FooterNav from "../FooterNav/FooterNav";

export default function MainLayout() {
    return (
        <>
            <Header />
            <main className="page-content">
                <Outlet />
            </main>
            <FooterNav />
        </>
    );
}