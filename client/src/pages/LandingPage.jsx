import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/ui/Icon.jsx";
import useAuthStore from "../store/authStore";

export default function LandingPage() {
    const navigate = useNavigate();
    const accessToken = useAuthStore((s) => s.accessToken);
    const user = useAuthStore((s) => s.user);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        if (accessToken && user) navigate("/app/workspaces", { replace: true });
    }, [accessToken, user, navigate]);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handler);
        return () => window.removeEventListener("scroll", handler);
    }, []);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-200">
            {/* Navbar */}
            <nav
                className={`fixed top-0 w-full z-[100] flex items-center justify-between px-8 h-18 transition-all duration-300 ${
                    scrolled 
                        ? "bg-black/60 backdrop-blur-xl border-b border-white/10" 
                        : "bg-transparent border-transparent"
                }`}
            >
                <div className="flex items-center gap-10">
                    <div className="flex items-center gap-2.5 cursor-pointer">
                        <img src="/logo.png" alt="CollabBoard Logo" className="w-8 h-8 rounded-lg object-contain" />
                        <span className="text-2xl font-extrabold text-white tracking-tight">CollabBoard</span>
                    </div>
                    <div className="hidden md:flex gap-6">
                        {["Features", "Solutions", "Pricing", "Resources"].map(link => (
                            <a 
                                key={link} 
                                href={`#${link.toLowerCase()}`} 
                                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                            >
                                {link}
                            </a>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-5">
                    <Link to="/login" className="text-sm font-semibold text-slate-400 hover:text-white transition-colors">
                        Log in
                    </Link>
                    <Link 
                        to="/register" 
                        className="text-sm font-semibold bg-white text-slate-950 px-5 py-2.5 rounded-full hover:-translate-y-0.5 transition-transform shadow-[0_4px_14px_rgba(255,255,255,0.1)]"
                    >
                        Get started
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-40 pb-20 px-6 text-center relative overflow-hidden">
                {/* Modern ambient background glows */}
                <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.3)_0%,_transparent_70%)] blur-[60px] pointer-events-none" />
                
                <div className="relative max-w-4xl mx-auto z-10">
                    
                    
                    <h1 className="text-[clamp(3.5rem,8vw,5.5rem)] font-extrabold text-white leading-[1.05] tracking-tight m-0">
                        Where agile teams <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-500">
                            build the future.
                        </span>
                    </h1>
                    <p className="text-[clamp(1.125rem,2vw,1.375rem)] text-slate-400 mt-6 leading-relaxed max-w-2xl mx-auto">
                        Kanban boards, infinite whiteboards, and real-time chat seamlessly integrated into a single, blazing-fast workspace.
                    </p>
                    <div className="flex gap-4 justify-center mt-10 flex-wrap">
                        <Link 
                            to="/register" 
                            className="bg-indigo-600 text-white px-8 py-4 text-base font-semibold rounded-xl flex items-center gap-2 shadow-[0_8px_24px_rgba(99,102,241,0.3)] hover:bg-indigo-500 transition-colors"
                        >
                            Start your workspace <Icon name="arrow-right" size={18} />
                        </Link>
                    </div>
                </div>

                {/* Hero Dashboard Abstract Mockup (Responsive) */}
                <div className="relative w-full max-w-[1000px] mx-auto mt-20 h-[440px] bg-[#0b0d14] border border-white/5 rounded-t-2xl shadow-[0_-20px_80px_rgba(0,0,0,0.8)] overflow-hidden border-b-0">
                    {/* Fake App Header */}
                    <div className="h-12 border-b border-white/5 flex items-center px-5 gap-2 bg-[#0b0d14]">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                        <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                    </div>

                    {/* Fake App Body */}
                    <div className="flex h-[calc(100%-3rem)]">
                        {/* Responsive Sidebar */}
                        <div className="hidden md:flex w-64 border-r border-white/5 p-6 shrink-0 flex-col gap-6 bg-[#0b0d14]">
                            <div className="h-3 w-24 bg-white/10 rounded-full" />
                            <div className="flex flex-col gap-4">
                                <div className="h-2 w-32 bg-white/5 rounded-full" />
                                <div className="h-2 w-28 bg-white/5 rounded-full" />
                                <div className="h-2 w-20 bg-white/5 rounded-full" />
                                <div className="h-2 w-16 bg-white/5 rounded-full" />
                            </div>
                        </div>

                        {/* Responsive Kanban Columns */}
                        <div className="flex-1 p-6 flex gap-6 overflow-x-auto snap-x snap-mandatory bg-[#0b0d14]">
                            {[1, 2, 3].map((colIndex) => (
                                <div key={colIndex} className="flex-1 min-w-[260px] snap-start bg-white/[0.02] rounded-2xl p-4 border border-white/[0.02] flex flex-col gap-4">
                                    {/* Column Header Skeleton */}
                                    <div className="h-2.5 w-12 bg-white/10 rounded-full mb-1 ml-1" />

                                    {/* Card 1 - Standard Block */}
                                    <div className="h-28 w-full bg-white/[0.03] rounded-xl border border-white/[0.02]" />

                                    {/* Card 2 - Active/Detailed with Glowing Border */}
                                    <div className="h-28 w-full bg-white/[0.03] rounded-xl border border-white/[0.02] border-l-[3px] border-l-indigo-400 shadow-[-4px_0_24px_rgba(99,102,241,0.15)] relative p-5 flex flex-col gap-3">
                                        {/* Inner Skeleton Lines */}
                                        <div className="h-2 w-16 bg-white/10 rounded-full" />
                                        <div className="h-2 w-28 bg-white/5 rounded-full" />
                                        
                                        {/* Inner Skeleton Avatar */}
                                        <div className="absolute bottom-4 right-4 h-4 w-4 bg-white/10 rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 px-6 flex flex-col gap-40 max-w-6xl mx-auto">
                
                {/* 1. Kanban */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                    <div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 border border-indigo-500/20">
                            <Icon name="kanban" size={24} />
                        </div>
                        <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                            Organize anything with powerful Kanban
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Track tasks, bugs, and features with highly customizable boards. Everything syncs instantly to your team, with rich text descriptions, attachments, and due dates.
                        </p>
                    </div>
                    {/* Highly Detailed Kanban Mockup */}
                    <div className="bg-[#14161e]/80 border border-white/10 rounded-2xl p-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)] backdrop-blur-md">
                        <div className="flex gap-4 overflow-hidden">
                            {/* Column 1 */}
                            <div className="flex-1 bg-white/[0.03] rounded-xl p-3 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-400">To Do</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs text-slate-500">2</span>
                                </div>
                                <div className="bg-[#1e293b] p-3.5 rounded-lg border border-white/5">
                                    <div className="flex gap-2 mb-2">
                                        <span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded font-semibold">Urgent</span>
                                        <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded font-semibold">Design</span>
                                    </div>
                                    <div className="text-sm text-white font-medium mb-3">Update homepage copy</div>
                                    <div className="flex justify-between items-center">
                                        <Icon name="paperclip" size={14} className="text-slate-500" />
                                        <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-[#1e293b]" />
                                    </div>
                                </div>
                            </div>
                            {/* Column 2 */}
                            <div className="flex-1 bg-white/[0.03] rounded-xl p-3 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-400">In Progress</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs text-slate-500">1</span>
                                </div>
                                <div className="bg-[#1e293b] p-3.5 rounded-lg border border-indigo-500/40 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]">
                                    <div className="flex gap-2 mb-2">
                                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-semibold">Feature</span>
                                    </div>
                                    <div className="text-sm text-white font-medium mb-3">Implement Auth0 login</div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1 text-slate-500 text-xs">
                                            <Icon name="message-square" size={12} /> 3
                                        </div>
                                        <div className="flex">
                                            <div className="w-5 h-5 rounded-full bg-pink-500 border-2 border-[#1e293b] z-10" />
                                            <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-[#1e293b] -ml-2 z-0" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Whiteboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                    <div className="md:order-2">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-500/20">
                            <Icon name="edit-3" size={24} />
                        </div>
                        <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                            Brainstorm on infinite whiteboards
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Map out user flows, architecture diagrams, and brainstorms. See your teammates' cursors fly across the screen as you draw and ideate together in real time.
                        </p>
                    </div>
                    {/* Detailed Whiteboard Mockup */}
                    <div className="md:order-1 h-80 bg-[radial-gradient(circle_at_50%_50%,_#14161e_0%,_#0a0c12_100%)] border border-white/10 rounded-2xl relative overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.4)]">
                        {/* Dot Grid */}
                        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px]" />
                        
                        {/* Nodes */}
                        <div className="absolute top-[60px] left-[80px] bg-[#1e293b] border-2 border-blue-500 rounded-lg py-3 px-5 text-white text-sm font-semibold shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
                            User Login
                        </div>
                        
                        <div className="absolute top-[180px] left-[240px] bg-[#1e293b] border-2 border-emerald-500 rounded-lg py-3 px-5 text-white text-sm font-semibold shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
                            Dashboard
                        </div>

                        {/* Connection Line */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <path d="M 160 85 C 220 85, 200 195, 240 195" fill="none" stroke="#6b7280" strokeWidth="2" />
                            <polygon points="235,190 242,195 235,200" fill="#6b7280" />
                        </svg>

                        {/* Multiplayer Cursors */}
                        <div className="absolute top-[120px] left-[180px] flex flex-col items-start">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#ec4899" stroke="white" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>
                            <div className="bg-pink-500 text-white px-2 py-0.5 rounded-r-lg rounded-bl-lg text-[10px] font-semibold mt-0.5">Sarah</div>
                        </div>

                        {/* Toolbar */}
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-2 flex flex-col gap-3">
                            {["mouse-pointer", "square", "type", "image"].map((icon, i) => (
                                <div key={icon} className={`w-7 h-7 flex items-center justify-center rounded-md ${i === 0 ? "bg-white/10 text-white" : "bg-transparent text-slate-500"}`}>
                                    <Icon name={icon} size={14} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 3. Chat */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                    <div>
                        <div className="w-12 h-12 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center mb-6 border border-pink-500/20">
                            <Icon name="message-circle" size={24} />
                        </div>
                        <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">
                            Contextual team chat
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed">
                            Stop context switching. Keep conversations right where the work happens. Featuring rich text formatting, file attachments, and thread replies to keep things organized.
                        </p>
                    </div>
                    {/* Detailed Chat Mockup */}
                    <div className="bg-[#14161e]/80 border border-white/10 rounded-2xl flex flex-col h-[360px] shadow-[0_24px_48px_rgba(0,0,0,0.4)] backdrop-blur-md overflow-hidden">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-white/5 flex items-center gap-3">
                            <div className="text-base font-bold text-white"># frontend-team</div>
                            <span className="bg-white/5 px-2 py-0.5 rounded-full text-xs text-slate-400">4 online</span>
                        </div>
                        {/* Messages */}
                        <div className="flex-1 p-5 flex flex-col gap-5 overflow-hidden">
                            <div className="flex gap-3 items-start">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 shrink-0 flex items-center justify-center text-white text-xs font-bold">AL</div>
                                <div>
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="text-sm font-semibold text-white">Alex</span>
                                        <span className="text-xs text-slate-500">10:42 AM</span>
                                    </div>
                                    <div className="bg-white/5 px-3.5 py-2.5 rounded-b-xl rounded-tr-xl text-sm text-slate-300 leading-relaxed">
                                        The new staging environment is up! 🚀 Everyone please test the kanban drag-and-drop.
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start flex-row-reverse">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-400 shrink-0 flex items-center justify-center text-white text-xs font-bold">YOU</div>
                                <div className="flex flex-col items-end">
                                    <div className="flex items-baseline gap-2 flex-row-reverse mb-1">
                                        <span className="text-sm font-semibold text-white">You</span>
                                        <span className="text-xs text-slate-500">10:45 AM</span>
                                    </div>
                                    <div className="bg-indigo-600 px-3.5 py-2.5 rounded-b-xl rounded-tl-xl text-sm text-white leading-relaxed">
                                        Awesome, jumping in to review the PRs now. Looks super smooth so far.
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Chat Input */}
                        <div className="p-4 border-t border-white/5 bg-black/20">
                            <div className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                <span className="text-slate-500 text-sm">Message #frontend-team...</span>
                                <div className="flex gap-3 text-slate-500 items-center">
                                    <Icon name="smile" size={16} />
                                    <Icon name="paperclip" size={16} />
                                    <div className="bg-indigo-600 rounded pt-1 pb-1 pl-1 pr-1 text-white flex">
                                        <Icon name="send" size={12} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Strip */}
            <section className="py-24 px-6 bg-gradient-to-b from-slate-950 to-indigo-900/10 text-center border-t border-white/5">
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-5xl font-extrabold text-white mb-5 tracking-tight">Ready to ship faster?</h2>
                    <p className="text-lg text-slate-400 mb-10 leading-relaxed">
                        Join thousands of agile teams already using CollabBoard to centralize their workflow and collaborate seamlessly.
                    </p>
                    <Link 
                        to="/register" 
                        className="bg-white text-slate-950 px-12 py-4 text-base font-semibold rounded-full inline-block shadow-[0_8px_24px_rgba(255,255,255,0.15)] hover:-translate-y-1 transition-transform"
                    >
                        Get started for free
                    </Link>
                    <p className="text-sm text-slate-500 mt-6">No credit card required. Free forever plan available.</p>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-950 border-t border-white/5 pt-20 pb-10">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
                    <div className="md:col-span-1">
                        <div className="flex items-center gap-2 mb-5">
                            <img src="/logo.png" alt="CollabBoard Logo" className="w-6 h-6 object-contain rounded-sm" />
                            <span className="text-lg font-bold text-white">CollabBoard</span>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                            The ultimate workspace for modern agile teams to plan, collaborate, and ship faster.
                        </p>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white mb-5">Product</h4>
                        <div className="flex flex-col gap-3">
                            {["Features", "Integrations", "Pricing", "Changelog", "Docs"].map(l => (
                                <a key={l} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white mb-5">Company</h4>
                        <div className="flex flex-col gap-3">
                            {["About Us", "Careers", "Blog", "Contact"].map(l => (
                                <a key={l} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a>
                            ))}
                        </div>
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white mb-5">Legal</h4>
                        <div className="flex flex-col gap-3">
                            {["Privacy Policy", "Terms of Service", "Security"].map(l => (
                                <a key={l} href="#" className="text-sm text-slate-400 hover:text-white transition-colors">{l}</a>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4 border-t border-white/5 pt-8">
                    <p className="text-sm text-slate-500 m-0">© {new Date().getFullYear()} CollabBoard Inc. All rights reserved.</p>
                    <div className="flex gap-4">
                        <Icon name="github" size={20} className="text-slate-500 hover:text-white cursor-pointer transition-colors" />
                        <Icon name="twitter" size={20} className="text-slate-500 hover:text-white cursor-pointer transition-colors" />
                    </div>
                </div>
            </footer>
        </div>
    );
}