import { ExternalLink, Mail } from "lucide-react";

const footerLinks = [
  {
    href: "https://github.com/mandelaokeke",
    label: "GitHub",
    icon: ExternalLink,
  },
  {
    href: "https://www.linkedin.com/in/mandela-jude-okeke/",
    label: "LinkedIn",
    icon: ExternalLink,
  },
  {
    href: "https://github.com/mandelaokeke/MandVision",
    label: "Project",
    icon: ExternalLink,
  },
  {
    href: "mailto:mandelaokeke@yahoo.com",
    label: "Email",
    icon: Mail,
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#070b10] px-4 py-7 text-slate-400 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl text-center md:text-left">
          <p className="text-sm font-medium text-slate-200">
            Made and produced by Mandela Okeke.
          </p>
          <p className="mt-1 text-xs leading-5">
            © {new Date().getFullYear()} MandVision. Built with Next.js, AWS, and OpenAI.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          {footerLinks.map((link) => {
            const Icon = link.icon;

            return (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 min-w-[7rem] items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-sm text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200 sm:min-w-0"
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </a>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
