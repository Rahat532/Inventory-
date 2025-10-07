import * as React from "react"

interface ToastProps {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

// Simple toast implementation
const toast = ({ title, description, variant = "default" }: ToastProps) => {
  // In a real app, this would show an actual toast notification
  // For now, we'll use a simple alert
  const message = description ? `${title}: ${description}` : title;
  
  if (variant === "destructive") {
    console.error(message);
    alert(`Error: ${message}`);
  } else {
    console.log(message);
    alert(`Success: ${message}`);
  }
}

export { toast }