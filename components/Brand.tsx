import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return <a className="brand" href="#inicio" aria-label="Logster, início">
    <Image src="/logster-mark.svg" width={42} height={26} alt="" />
    {!compact && <span>Logster</span>}
  </a>;
}
