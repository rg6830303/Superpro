import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, GraduationCap, ShoppingBag, Users } from "lucide-react";

export function DemoHomeHero({ name, slots }: { name?: string; slots: number }) {
  return <div className="demo-home-intro">
    <div className="demo-home-topline"><span><i /> KOLKATA’S PICKLEBALL CLUB</span><span>GOOD PEOPLE. GREAT RALLIES.</span></div>
    <section className="demo-hero">
      <div className="demo-hero-copy"><p className="demo-overline">{name ? `YOUR DAILY DOSE OF PLAY · ${name.split(" ")[0]}` : "MORE THAN A GAME. YOUR KIND OF CLUB."}</p><h1>{name ? <>Hey {name.split(" ")[0]},<br />court’s <em>calling.</em></> : <>Less scrolling.<br />More <em>rallying.</em></>}</h1><p>Find your game. Meet your people. Make a little room for a whole lot of pickleball.</p><div className="demo-hero-actions"><Link href="/games" className="btn-primary">Find my next game <ArrowUpRight size={18} /></Link><Link href={name ? "/dashboard" : "/signup"} className="demo-hero-secondary">{name ? "My clubhouse" : "Join the club"}<ArrowRight size={17} /></Link></div><div className="demo-hero-foot"><span className="demo-avatar-stack"><b>01</b><b>02</b><b>YOU</b></span><span>Every level. Every kind of player.<small>{slots > 0 ? `${slots} open slots this week. Find yours.` : "Your next favourite ritual starts here."}</small></span></div></div>
      <div className="demo-hero-art"><div className="demo-court-lines" aria-hidden="true"><span /><span /><span /></div><span className="demo-art-caption">MEET YOU AT<br />THE KITCHEN.</span><div className="demo-paddle-wrap"><Image src="/products/paddle-ball-hero.png" alt="Sparvic pickleball paddle and ball" width={700} height={700} priority className="demo-hero-paddle" /></div><div className="demo-art-sticker">ALL PLAY.<br /><strong>NO PAUSE.</strong><ArrowUpRight size={23} /></div><span className="demo-art-bottom">THE COURT IS YOURS ↗</span></div>
    </section>
    <div className="demo-services">{[
      { href: "/games", title: "Get on court", detail: "Daily games & easy bookings", Icon: CalendarDays, tone: "green" },
      { href: "/players", title: "Find your crew", detail: "Players, profiles & connections", Icon: Users, tone: "peach" },
      { href: "/products", title: "Gear up", detail: "Paddles, balls & the good stuff", Icon: ShoppingBag, tone: "yellow" },
      { href: "/coaching", title: "Level up", detail: "Coaching for your next chapter", Icon: GraduationCap, tone: "purple" },
    ].map(({ href, title, detail, Icon, tone }) => <Link href={href} key={href} className={`demo-service demo-service-${tone}`}><span className="demo-service-icon"><Icon size={23} /></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight className="demo-service-arrow" size={18} /></Link>)}</div>
  </div>;
}
