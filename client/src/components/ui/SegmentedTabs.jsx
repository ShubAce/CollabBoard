import { motion } from "framer-motion";
import { SPRING } from "../../lib/motion";
import Icon from "./Icon.jsx";

/**
 * Segmented control whose active pill glides between options.
 * items: [{ value, label, icon? }]. `id` must be unique per page (shared layoutId).
 */
export default function SegmentedTabs({ id, items, value, onChange, className = "" }) {
	return (
		<div
			className={`seg-tabs ${className}`}
			role="tablist"
		>
			{items.map((item) => {
				const active = item.value === value;
				return (
					<button
						key={item.value}
						type="button"
						role="tab"
						aria-selected={active}
						className={`seg-tab${active ? " active" : ""}`}
						onClick={() => onChange(item.value)}
					>
						{active && (
							<motion.span
								layoutId={`seg-${id}`}
								className="seg-pill"
								transition={SPRING}
							/>
						)}
						{item.icon && (
							<Icon
								name={item.icon}
								size={14}
							/>
						)}
						<span>{item.label}</span>
						{item.count !== undefined && <span className="seg-count">{item.count}</span>}
					</button>
				);
			})}
		</div>
	);
}
