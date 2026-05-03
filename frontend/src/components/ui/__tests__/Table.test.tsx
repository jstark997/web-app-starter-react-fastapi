import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from '@/components/ui/Table';
import type { TableColumn } from '@/components/ui/Table';

interface TestItem {
  id: string;
  name: string;
  email: string;
}

const testData: TestItem[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const columns: TableColumn<TestItem>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (item) => item.name },
  { key: 'email', header: 'Email', sortable: true, hideOnMobile: true, render: (item) => item.email },
];

describe('Table', () => {
  it('renders column headers and row data', () => {
    render(
      <Table columns={columns} data={testData} rowKey={(item) => item.id} />,
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('calls onSort when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();

    render(
      <Table columns={columns} data={testData} rowKey={(item) => item.id} onSort={onSort} />,
    );

    await user.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('does not call onSort for non-sortable columns', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    const cols: TableColumn<TestItem>[] = [
      { key: 'name', header: 'Name', sortable: false, render: (item) => item.name },
    ];

    render(
      <Table columns={cols} data={testData} rowKey={(item) => item.id} onSort={onSort} />,
    );

    await user.click(screen.getByText('Name'));
    expect(onSort).not.toHaveBeenCalled();
  });

  it('shows sort direction indicator for active sort column', () => {
    render(
      <Table
        columns={columns}
        data={testData}
        rowKey={(item) => item.id}
        sortBy="name"
        sortOrder="asc"
      />,
    );

    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(nameHeader?.textContent).toContain('▲');
  });

  it('shows descending indicator', () => {
    render(
      <Table
        columns={columns}
        data={testData}
        rowKey={(item) => item.id}
        sortBy="name"
        sortOrder="desc"
      />,
    );

    const nameHeader = screen.getByText('Name').closest('th');
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    expect(nameHeader?.textContent).toContain('▼');
  });

  it('renders skeleton rows when isLoading is true', () => {
    const { container } = render(
      <Table columns={columns} data={[]} rowKey={(item) => item.id} isLoading />,
    );

    const skeletonRows = container.querySelectorAll('tbody tr');
    expect(skeletonRows.length).toBe(5);
  });

  it('renders empty message when data is empty and not loading', () => {
    render(
      <Table columns={columns} data={[]} rowKey={(item) => item.id} />,
    );

    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('renders custom empty message', () => {
    render(
      <Table
        columns={columns}
        data={[]}
        rowKey={(item) => item.id}
        emptyMessage="No users found."
      />,
    );

    expect(screen.getByText('No users found.')).toBeInTheDocument();
  });

  it('applies hideOnMobile class to columns', () => {
    const { container } = render(
      <Table columns={columns} data={testData} rowKey={(item) => item.id} />,
    );

    const emailHeader = screen.getByText('Email').closest('th');
    expect(emailHeader?.className).toContain('hidden');
    expect(emailHeader?.className).toContain('md:table-cell');

    // Check data cells too
    const emailCells = container.querySelectorAll('td.hidden.md\\:table-cell');
    expect(emailCells.length).toBe(2);
  });
});
