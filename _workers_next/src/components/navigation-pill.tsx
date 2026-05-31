'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useRef, useState, useEffect } from 'react'

interface NavigationPillProps {
    items: Array<{ key: string; label: string }>
    selectedKey: string | null
    onSelect?: (key: string) => void
}

export function NavigationPill({ items, selectedKey, onSelect }: NavigationPillProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const activeIndex = items.findIndex(item => item.key === selectedKey)
        const activeElement = container.children[activeIndex] as HTMLElement | undefined

        if (activeElement) {
            setIndicatorStyle({
                left: container.offsetLeft + activeElement.offsetLeft,
                width: activeElement.offsetWidth,
            })
        } else {
            // Default to first item if nothing selected
            const firstElement = container.children[0] as HTMLElement | undefined
            if (firstElement) {
                setIndicatorStyle({
                    left: container.offsetLeft + firstElement.offsetLeft,
                    width: firstElement.offsetWidth,
                })
            }
        }
    }, [selectedKey, items])

    return (
        <div className="relative inline-flex items-center rounded-full bg-muted/60 p-1 backdrop-blur-sm">
            {/* Animated background indicator */}
            <motion.div
                className="absolute top-1 h-[calc(100%-8px)] rounded-full bg-background shadow-sm"
                initial={false}
                animate={{
                    left: indicatorStyle.left,
                    width: indicatorStyle.width,
                }}
                transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 35,
                }}
            />

            {/* Navigation items */}
            <div ref={containerRef} className="relative z-10 flex items-center">
                {items.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={cn(
                            'relative inline-flex h-8 items-center justify-center rounded-full px-4 text-sm font-medium leading-none whitespace-nowrap transition-colors duration-200',
                            selectedKey === item.key
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground/80'
                        )}
                        onClick={() => onSelect?.(item.key)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    )
}
