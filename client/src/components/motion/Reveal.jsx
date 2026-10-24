import { motion } from "framer-motion";
import { EASE_OUT } from "../../lib/motion";

/** Fades content up the first time it scrolls into view. */
export default function Reveal({ as = "div", delay = 0, y = 24, className, style, children, ...rest }) {
	const Component = motion[as];
	return (
		<Component
			className={className}
			style={style}
			initial={{ opacity: 0, y }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "0px 0px -80px 0px" }}
			transition={{ duration: 0.7, ease: EASE_OUT, delay }}
			{...rest}
		>
			{children}
		</Component>
	);
}
