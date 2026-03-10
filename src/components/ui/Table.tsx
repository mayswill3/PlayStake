import { type ComponentProps } from 'react';

export function Table({ className = '', children, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={`w-full text-sm text-left ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = '', children, ...props }: ComponentProps<'thead'>) {
  return (
    <thead
      className={`text-xs uppercase text-surface-400 border-b border-surface-800 ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ className = '', children, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody className={`divide-y divide-surface-800 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className = '', children, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={`hover:bg-surface-800/50 transition-colors ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className = '', children, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={`px-4 py-3 font-medium ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className = '', children, ...props }: ComponentProps<'td'>) {
  return (
    <td className={`px-4 py-3 text-surface-300 ${className}`} {...props}>
      {children}
    </td>
  );
}
