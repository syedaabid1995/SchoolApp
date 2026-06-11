'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../../components/PageHeader';
import { useNotify } from '../../../components/NotificationProvider';
import { getSession } from '../../../services/auth.service';
import { listSubjects } from '../../../services/academic.service';
import { listSchools } from '../../../services/school.service';
import {
  cancelLibraryMember,
  createLibraryBook,
  createLibraryCategory,
  createLibraryMember,
  deleteLibraryBook,
  deleteLibraryCategory,
  issueLibraryBook,
  listIssuedLibraryBooks,
  listLibraryBooks,
  listLibraryCategories,
  listLibraryMembers,
  listMemberIssues,
  returnLibraryBook,
  updateLibraryBook,
  updateLibraryCategory,
  type LibraryBook,
  type LibraryBookCategory,
  type LibraryIssue,
  type LibraryMember,
  type LibraryMemberType,
} from '../../../services/library.service';

type TabId = 'books' | 'categories' | 'members' | 'issue' | 'issued';
type AcademicOption = { id: string; name: string; code?: string | null; classId?: string | null };

const tabs: Array<{ id: TabId; label: string; description: string }> = [
  { id: 'books', label: 'Book List', description: 'Add, edit, and delete books' },
  { id: 'categories', label: 'Book Categories', description: 'Manage category list' },
  { id: 'members', label: 'Add Member', description: 'Create and cancel library members' },
  { id: 'issue', label: 'Issue Books', description: 'Issue or return books to members' },
  { id: 'issued', label: 'Issued Book List', description: 'Search issued book records' },
];

const emptyBookForm = {
  id: '',
  title: '',
  categoryId: '',
  subjectId: '',
  bookNumber: '',
  isbnNumber: '',
  publisherName: '',
  authorName: '',
  rackNumber: '',
  quantity: '1',
  price: '',
  description: '',
};
const emptyCategoryForm = { id: '', name: '', description: '' };
const emptyMemberForm = { memberType: 'STUDENT' as LibraryMemberType, memberId: '' };
const emptyIssueForm = { bookId: '', returnDate: '', note: '' };
const emptyIssuedFilters = { bookId: '', bookNumber: '', subjectId: '' };

const getErrorMessage = (error: unknown, fallback = 'Something went wrong') =>
  (error as any)?.response?.data?.error?.message ||
  (error as any)?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

const money = (value?: string | number | null) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric.toFixed(2).replace(/\.00$/, '') : '0';
};
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:bg-slate-50 disabled:text-slate-400';

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const PrimaryButton = ({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[var(--theme-button-bg)] to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const SecondaryButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const DangerButton = ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const FormCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <h2 className="text-lg font-bold text-slate-950">{title}</h2>
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const ListCard = ({
  title,
  children,
  search,
  setSearch,
}: {
  title: string;
  children: React.ReactNode;
  search?: string;
  setSearch?: (value: string) => void;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      {setSearch ? (
        <input className={`${inputClass} sm:max-w-xs`} placeholder="Quick search..." value={search ?? ''} onChange={(event) => setSearch(event.target.value)} />
      ) : null}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

export default function LibraryPage() {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [activeTab, setActiveTab] = useState<TabId>('books');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [issuedSearch, setIssuedSearch] = useState('');
  const [bookForm, setBookForm] = useState(emptyBookForm);
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [memberForm, setMemberForm] = useState(emptyMemberForm);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
  const [issuedFilters, setIssuedFilters] = useState(emptyIssuedFilters);
  const [submittedIssuedFilters, setSubmittedIssuedFilters] = useState(emptyIssuedFilters);

  const { data: session, isLoading: sessionLoading } = useQuery({ queryKey: ['session'], queryFn: getSession });
  const isSuperAdmin = session?.role === 'SUPER_ADMIN';
  const isSchoolAdmin = session?.role === 'SCHOOL_ADMIN';
  const permissionCodes = session?.permissionCodes ?? [];
  const schoolsQuery = useQuery({
    queryKey: ['schools', 'library'],
    queryFn: () => listSchools({ limit: 100, status: 'ACTIVE' }),
    enabled: Boolean(isSuperAdmin),
  });

  useEffect(() => {
    if (isSuperAdmin && !selectedSchoolId && schoolsQuery.data?.items?.length) {
      setSelectedSchoolId(schoolsQuery.data.items[0].id);
    }
  }, [isSuperAdmin, schoolsQuery.data?.items, selectedSchoolId]);

  const effectiveSchoolId = isSuperAdmin ? selectedSchoolId : session?.schoolId ?? '';
  const scopedParams = effectiveSchoolId ? { schoolId: effectiveSchoolId } : undefined;
  const canUsePage = isSuperAdmin || isSchoolAdmin || permissionCodes.includes('library.view');
  const canQuery = Boolean(canUsePage && effectiveSchoolId);

  useEffect(() => {
    setSelectedMemberId('');
    setIssueForm(emptyIssueForm);
  }, [effectiveSchoolId]);

  const subjectsQuery = useQuery({
    queryKey: ['library-subjects', effectiveSchoolId],
    queryFn: () => listSubjects(scopedParams),
    enabled: canQuery,
  });
  const categoriesQuery = useQuery({
    queryKey: ['library-categories', effectiveSchoolId, categorySearch],
    queryFn: () => listLibraryCategories({ ...scopedParams, search: categorySearch }),
    enabled: canQuery,
  });
  const booksQuery = useQuery({
    queryKey: ['library-books', effectiveSchoolId, bookSearch],
    queryFn: () => listLibraryBooks({ ...scopedParams, search: bookSearch }),
    enabled: canQuery,
  });
  const membersQuery = useQuery({
    queryKey: ['library-members', effectiveSchoolId, memberSearch],
    queryFn: () => listLibraryMembers({ ...scopedParams, search: memberSearch }),
    enabled: canQuery,
  });
  const memberIssuesQuery = useQuery({
    queryKey: ['library-member-issues', effectiveSchoolId, selectedMemberId],
    queryFn: () => listMemberIssues(selectedMemberId, scopedParams),
    enabled: canQuery && Boolean(selectedMemberId),
  });
  const issuedQuery = useQuery({
    queryKey: ['library-issued', effectiveSchoolId, submittedIssuedFilters, issuedSearch],
    queryFn: () => listIssuedLibraryBooks({ ...scopedParams, ...submittedIssuedFilters, search: issuedSearch }),
    enabled: canQuery,
  });

  const subjects = (subjectsQuery.data ?? []) as AcademicOption[];
  const categories = categoriesQuery.data ?? [];
  const books = booksQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const selectedMember = members.find((item) => item.id === selectedMemberId) ?? null;
  const availableBooks = books.filter((item) => (item.availableCopies ?? item.quantity) > 0 || item.id === issueForm.bookId);

  const invalidateLibrary = () => {
    queryClient.invalidateQueries({ queryKey: ['library-categories'] });
    queryClient.invalidateQueries({ queryKey: ['library-books'] });
    queryClient.invalidateQueries({ queryKey: ['library-members'] });
    queryClient.invalidateQueries({ queryKey: ['library-member-issues'] });
    queryClient.invalidateQueries({ queryKey: ['library-issued'] });
  };

  const onSuccess = (message: string) => {
    notify.success('Library updated', message);
    invalidateLibrary();
  };
  const onError = (error: unknown) => notify.error('Action failed', getErrorMessage(error));

  const categoryMutation = useMutation({
    mutationFn: () => {
      const payload = { ...scopedParams, name: categoryForm.name, description: categoryForm.description || null };
      return categoryForm.id ? updateLibraryCategory(categoryForm.id, payload) : createLibraryCategory(payload);
    },
    onSuccess: () => {
      setCategoryForm(emptyCategoryForm);
      onSuccess('Category saved.');
    },
    onError,
  });

  const bookMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...scopedParams,
        title: bookForm.title,
        categoryId: bookForm.categoryId,
        subjectId: bookForm.subjectId,
        bookNumber: bookForm.bookNumber || null,
        isbnNumber: bookForm.isbnNumber || null,
        publisherName: bookForm.publisherName || null,
        authorName: bookForm.authorName || null,
        rackNumber: bookForm.rackNumber || null,
        quantity: Number(bookForm.quantity),
        price: bookForm.price ? Number(bookForm.price) : null,
        description: bookForm.description || null,
      };
      return bookForm.id ? updateLibraryBook(bookForm.id, payload) : createLibraryBook(payload);
    },
    onSuccess: () => {
      setBookForm(emptyBookForm);
      onSuccess('Book saved.');
    },
    onError,
  });

  const memberMutation = useMutation({
    mutationFn: () => createLibraryMember({ ...scopedParams, memberType: memberForm.memberType, memberId: memberForm.memberId }),
    onSuccess: (member) => {
      setMemberForm(emptyMemberForm);
      setSelectedMemberId(member.id);
      onSuccess('Member saved.');
    },
    onError,
  });

  const issueMutation = useMutation({
    mutationFn: () => issueLibraryBook(selectedMemberId, { ...scopedParams, bookId: issueForm.bookId, returnDate: issueForm.returnDate || null, note: issueForm.note || null }),
    onSuccess: () => {
      setIssueForm(emptyIssueForm);
      onSuccess('Book issued.');
    },
    onError,
  });

  const confirmDelete = (message: string, action: () => Promise<unknown>) => {
    if (!window.confirm(message)) return;
    action()
      .then(() => onSuccess('Record updated.'))
      .catch(onError);
  };

  const validateCategory = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!categoryForm.name.trim()) return notify.error('Validation error', 'Category name is required.');
    categoryMutation.mutate();
  };

  const validateBook = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!bookForm.title.trim()) return notify.error('Validation error', 'Book title is required.');
    if (!bookForm.categoryId) return notify.error('Validation error', 'Select book category.');
    if (!bookForm.subjectId) return notify.error('Validation error', 'Select subject.');
    if (!Number.isFinite(Number(bookForm.quantity)) || Number(bookForm.quantity) < 1) return notify.error('Validation error', 'Quantity must be at least 1.');
    if (bookForm.price && Number(bookForm.price) < 0) return notify.error('Validation error', 'Book price cannot be negative.');
    bookMutation.mutate();
  };

  const validateMember = () => {
    if (!effectiveSchoolId) return notify.error('Validation error', 'Select a school first.');
    if (!memberForm.memberType) return notify.error('Validation error', 'Select member type.');
    if (!memberForm.memberId.trim()) return notify.error('Validation error', 'Member ID is required.');
    memberMutation.mutate();
  };

  const validateIssue = () => {
    if (!selectedMemberId) return notify.error('Validation error', 'Select a member first.');
    if (!issueForm.bookId) return notify.error('Validation error', 'Select a book.');
    issueMutation.mutate();
  };

  const editBook = (item: LibraryBook) => {
    setBookForm({
      id: item.id,
      title: item.title,
      categoryId: item.categoryId,
      subjectId: item.subjectId,
      bookNumber: item.bookNumber ?? '',
      isbnNumber: item.isbnNumber ?? '',
      publisherName: item.publisherName ?? '',
      authorName: item.authorName ?? '',
      rackNumber: item.rackNumber ?? '',
      quantity: String(item.quantity),
      price: item.price == null ? '' : String(item.price),
      description: item.description ?? '',
    });
  };

  const pageActions = isSuperAdmin ? (
    <select className={`${inputClass} min-w-64`} value={selectedSchoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
      <option value="">Select school</option>
      {schoolsQuery.data?.items?.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
    </select>
  ) : null;

  if (sessionLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Checking library access...</div>;
  }

  if (!canUsePage) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-sm text-red-700">Only super admins and school admins can manage library.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Library" subtitle="Manage books, categories, members, issue records, and issued book reports." actions={pageActions} />

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-3 text-left transition ${activeTab === tab.id ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              <span className="block text-sm font-bold">{tab.label}</span>
              <span className={`mt-1 block text-xs ${activeTab === tab.id ? 'text-purple-100' : 'text-slate-500'}`}>{tab.description}</span>
            </button>
          ))}
        </div>
      </div>

      {!effectiveSchoolId ? <EmptyState message="Select a school to manage library records." /> : null}

      {effectiveSchoolId && activeTab === 'books' ? (
        <TwoColumnSection
          title={bookForm.id ? 'Edit Book' : 'Add Book'}
          listTitle="Book List"
          search={bookSearch}
          setSearch={setBookSearch}
          isLoading={booksQuery.isFetching}
          emptyMessage="No books found."
          form={(
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Book title *"><input className={inputClass} value={bookForm.title} onChange={(event) => setBookForm((prev) => ({ ...prev, title: event.target.value }))} /></Field>
                <Field label="Book category *">
                  <select className={inputClass} value={bookForm.categoryId} onChange={(event) => setBookForm((prev) => ({ ...prev, categoryId: event.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Subjects *">
                  <select className={inputClass} value={bookForm.subjectId} onChange={(event) => setBookForm((prev) => ({ ...prev, subjectId: event.target.value }))}>
                    <option value="">Select subject</option>
                    {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </Field>
                <Field label="Book no."><input className={inputClass} value={bookForm.bookNumber} onChange={(event) => setBookForm((prev) => ({ ...prev, bookNumber: event.target.value }))} /></Field>
                <Field label="ISBN no."><input className={inputClass} value={bookForm.isbnNumber} onChange={(event) => setBookForm((prev) => ({ ...prev, isbnNumber: event.target.value }))} /></Field>
                <Field label="Publisher name"><input className={inputClass} value={bookForm.publisherName} onChange={(event) => setBookForm((prev) => ({ ...prev, publisherName: event.target.value }))} /></Field>
                <Field label="Author name"><input className={inputClass} value={bookForm.authorName} onChange={(event) => setBookForm((prev) => ({ ...prev, authorName: event.target.value }))} /></Field>
                <Field label="Rack number"><input className={inputClass} value={bookForm.rackNumber} onChange={(event) => setBookForm((prev) => ({ ...prev, rackNumber: event.target.value }))} /></Field>
                <Field label="Quantity"><input className={inputClass} type="number" min={1} value={bookForm.quantity} onChange={(event) => setBookForm((prev) => ({ ...prev, quantity: event.target.value }))} /></Field>
                <Field label="Book price"><input className={inputClass} type="number" min={0} step="0.01" value={bookForm.price} onChange={(event) => setBookForm((prev) => ({ ...prev, price: event.target.value }))} /></Field>
              </div>
              <Field label="Description"><textarea className={inputClass} rows={3} value={bookForm.description} onChange={(event) => setBookForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={bookMutation.isPending} onClick={validateBook}>Save Book</PrimaryButton>
                <SecondaryButton onClick={() => setBookForm(emptyBookForm)}>Cancel</SecondaryButton>
              </div>
            </>
          )}
          table={<BookTable items={books} onEdit={editBook} onDelete={(item) => confirmDelete(`Delete book "${item.title}"?`, () => deleteLibraryBook(item.id, scopedParams))} />}
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'categories' ? (
        <TwoColumnSection
          title={categoryForm.id ? 'Edit Book Categories' : 'Add Book Categories'}
          listTitle="Category List"
          search={categorySearch}
          setSearch={setCategorySearch}
          isLoading={categoriesQuery.isFetching}
          emptyMessage="No categories found."
          form={(
            <>
              <Field label="Category name *"><input className={inputClass} value={categoryForm.name} onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))} /></Field>
              <Field label="Description"><textarea className={inputClass} rows={4} value={categoryForm.description} onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))} /></Field>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton disabled={categoryMutation.isPending} onClick={validateCategory}>Save Category</PrimaryButton>
                <SecondaryButton onClick={() => setCategoryForm(emptyCategoryForm)}>Cancel</SecondaryButton>
              </div>
            </>
          )}
          table={(
            <CategoryTable
              items={categories}
              onEdit={(item) => setCategoryForm({ id: item.id, name: item.name, description: item.description ?? '' })}
              onDelete={(item) => confirmDelete(`Delete category "${item.name}"?`, () => deleteLibraryCategory(item.id, scopedParams))}
            />
          )}
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'members' ? (
        <TwoColumnSection
          title="Add Member"
          listTitle="Member List"
          search={memberSearch}
          setSearch={setMemberSearch}
          isLoading={membersQuery.isFetching}
          emptyMessage="No members found."
          form={(
            <>
              <Field label="Member type *">
                <select className={inputClass} value={memberForm.memberType} onChange={(event) => setMemberForm((prev) => ({ ...prev, memberType: event.target.value as LibraryMemberType }))}>
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="STAFF">Staff</option>
                </select>
              </Field>
              <Field label="Member ID *"><input className={inputClass} value={memberForm.memberId} onChange={(event) => setMemberForm((prev) => ({ ...prev, memberId: event.target.value }))} /></Field>
              <PrimaryButton disabled={memberMutation.isPending} onClick={validateMember}>Save Member</PrimaryButton>
            </>
          )}
          table={(
            <MemberTable
              items={members}
              onIssue={(item) => {
                setSelectedMemberId(item.id);
                setActiveTab('issue');
              }}
              onCancel={(item) => confirmDelete(`Cancel membership for "${item.fullName}"?`, () => cancelLibraryMember(item.id, scopedParams))}
            />
          )}
        />
      ) : null}

      {effectiveSchoolId && activeTab === 'issue' ? (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-5">
            <FormCard title="Members">
              <input className={inputClass} placeholder="Search member..." value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} />
              {membersQuery.isFetching ? <LoadingSkeleton /> : <IssueMemberList items={members} selectedId={selectedMemberId} onSelect={(item) => setSelectedMemberId(item.id)} />}
            </FormCard>
            <FormCard title="Issue Book">
              <Field label="Select book *">
                <select className={inputClass} value={issueForm.bookId} disabled={!selectedMemberId} onChange={(event) => setIssueForm((prev) => ({ ...prev, bookId: event.target.value }))}>
                  <option value="">Select book</option>
                  {availableBooks.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}{item.bookNumber ? ` (${item.bookNumber})` : ''} - {item.availableCopies ?? item.quantity} left
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Return date"><input className={inputClass} type="date" value={issueForm.returnDate} disabled={!selectedMemberId} onChange={(event) => setIssueForm((prev) => ({ ...prev, returnDate: event.target.value }))} /></Field>
              <Field label="Note"><textarea className={inputClass} rows={3} value={issueForm.note} disabled={!selectedMemberId} onChange={(event) => setIssueForm((prev) => ({ ...prev, note: event.target.value }))} /></Field>
              <PrimaryButton disabled={issueMutation.isPending || !selectedMemberId} onClick={validateIssue}>Issue Book</PrimaryButton>
            </FormCard>
          </div>
          <ListCard title="Issued Book">
            <MemberIssuePanel
              member={selectedMember}
              issues={memberIssuesQuery.data ?? []}
              isLoading={memberIssuesQuery.isFetching}
              onReturn={(issue) => confirmDelete(`Return "${issue.book?.title ?? 'this book'}"?`, () => returnLibraryBook(issue.id, scopedParams))}
            />
          </ListCard>
        </div>
      ) : null}

      {effectiveSchoolId && activeTab === 'issued' ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">Select Criteria</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field label="Select book name">
                <select className={inputClass} value={issuedFilters.bookId} onChange={(event) => setIssuedFilters((prev) => ({ ...prev, bookId: event.target.value }))}>
                  <option value="">Select book</option>
                  {books.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </Field>
              <Field label="Search by book ID"><input className={inputClass} value={issuedFilters.bookNumber} onChange={(event) => setIssuedFilters((prev) => ({ ...prev, bookNumber: event.target.value }))} /></Field>
              <Field label="Select subjects">
                <select className={inputClass} value={issuedFilters.subjectId} onChange={(event) => setIssuedFilters((prev) => ({ ...prev, subjectId: event.target.value }))}>
                  <option value="">Select subject</option>
                  {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <div className="flex items-end">
                <PrimaryButton onClick={() => setSubmittedIssuedFilters(issuedFilters)} disabled={issuedQuery.isFetching}>Search</PrimaryButton>
              </div>
            </div>
          </section>
          <ListCard title="All Issued Book" search={issuedSearch} setSearch={setIssuedSearch}>
            {issuedQuery.isFetching ? <LoadingSkeleton /> : <IssuedTable rows={issuedQuery.data ?? []} />}
          </ListCard>
        </div>
      ) : null}
    </div>
  );
}

function TwoColumnSection({
  title,
  listTitle,
  form,
  table,
  isLoading,
  emptyMessage,
  search,
  setSearch,
}: {
  title: string;
  listTitle: string;
  form: React.ReactNode;
  table: React.ReactNode;
  isLoading: boolean;
  emptyMessage: string;
  search?: string;
  setSearch?: (value: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <FormCard title={title}>{form}</FormCard>
      <ListCard title={listTitle} search={search} setSearch={setSearch}>
        {isLoading ? <LoadingSkeleton /> : table || <EmptyState message={emptyMessage} />}
      </ListCard>
    </div>
  );
}

function CategoryTable({ items, onEdit, onDelete }: { items: LibraryBookCategory[]; onEdit: (item: LibraryBookCategory) => void; onDelete: (item: LibraryBookCategory) => void }) {
  if (!items.length) return <EmptyState message="No categories found." />;
  return (
    <DataTable headers={['Category Title', 'Books', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.name}</Cell>
          <Cell>{item._count?.books ?? 0}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function BookTable({ items, onEdit, onDelete }: { items: LibraryBook[]; onEdit: (item: LibraryBook) => void; onDelete: (item: LibraryBook) => void }) {
  if (!items.length) return <EmptyState message="No books found." />;
  return (
    <DataTable headers={['Book Title', 'Book No.', 'ISBN No.', 'Category', 'Subject', 'Publisher Name', 'Author Name', 'Quantity', 'Price', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.title}</Cell>
          <Cell>{item.bookNumber || '-'}</Cell>
          <Cell>{item.isbnNumber || '-'}</Cell>
          <Cell>{item.category?.name ?? '-'}</Cell>
          <Cell>{item.subject?.name ?? '-'}</Cell>
          <Cell>{item.publisherName || '-'}</Cell>
          <Cell>{item.authorName || '-'}</Cell>
          <Cell>{item.quantity} <span className="text-xs text-slate-400">({item.availableCopies ?? item.quantity} left)</span></Cell>
          <Cell>{money(item.price)}</Cell>
          <ActionCell onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
        </tr>
      ))}
    </DataTable>
  );
}

function MemberTable({ items, onIssue, onCancel }: { items: LibraryMember[]; onIssue: (item: LibraryMember) => void; onCancel: (item: LibraryMember) => void }) {
  if (!items.length) return <EmptyState message="No members found." />;
  return (
    <DataTable headers={['Member ID', 'Full Name', 'Member Type', 'Phone', 'Email', 'Status', 'Actions']}>
      {items.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.memberCode}</Cell>
          <Cell>{item.fullName}</Cell>
          <Cell>{displayMemberType(item.memberType)}</Cell>
          <Cell>{item.phone || '-'}</Cell>
          <Cell>{item.email || '-'}</Cell>
          <Cell><StatusPill status={item.active ? 'ACTIVE' : 'CANCELED'} /></Cell>
          <td className="px-4 py-3 align-top">
            <div className="flex flex-wrap justify-end gap-2">
              <PrimaryButton disabled={!item.active} onClick={() => onIssue(item)}>Issue / Return Book</PrimaryButton>
              <DangerButton disabled={!item.active} onClick={() => onCancel(item)}>Cancel Membership</DangerButton>
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function IssueMemberList({ items, selectedId, onSelect }: { items: LibraryMember[]; selectedId: string; onSelect: (item: LibraryMember) => void }) {
  const activeItems = items.filter((item) => item.active);
  if (!activeItems.length) return <EmptyState message="No active members found." />;
  return (
    <div className="space-y-2">
      {activeItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedId === item.id ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <span className="block text-sm font-bold text-slate-900">{item.fullName}</span>
          <span className="mt-1 block text-xs text-slate-500">{displayMemberType(item.memberType)} - {item.memberCode}</span>
        </button>
      ))}
    </div>
  );
}

function MemberIssuePanel({
  member,
  issues,
  isLoading,
  onReturn,
}: {
  member: LibraryMember | null;
  issues: LibraryIssue[];
  isLoading: boolean;
  onReturn: (issue: LibraryIssue) => void;
}) {
  if (!member) return <EmptyState message="Select a member to issue or return books." />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-purple-100 text-lg font-bold text-purple-700">
              {member.fullName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-slate-950">{member.fullName}</p>
              <p className="text-xs text-slate-500">{displayMemberType(member.memberType)}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <InfoRow label="Member ID" value={member.memberCode} />
            <InfoRow label="Mobile" value={member.phone || '-'} />
            <InfoRow label="Email" value={member.email || '-'} />
          </div>
        </div>
        <div>
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <MemberIssuesTable issues={issues} onReturn={onReturn} />
          )}
        </div>
      </div>
    </div>
  );
}

function MemberIssuesTable({ issues, onReturn }: { issues: LibraryIssue[]; onReturn: (issue: LibraryIssue) => void }) {
  if (!issues.length) return <EmptyState message="No issued books found for this member." />;
  return (
    <DataTable headers={['Book Title', 'Book Number', 'Issue Date', 'Return Date', 'Status', 'Actions']}>
      {issues.map((item) => (
        <tr key={item.id}>
          <Cell strong>{item.book?.title ?? '-'}</Cell>
          <Cell>{item.book?.bookNumber || '-'}</Cell>
          <Cell>{formatDate(item.issueDate)}</Cell>
          <Cell>{formatDate(item.returnDate)}</Cell>
          <Cell><StatusPill status={item.status} /></Cell>
          <td className="px-4 py-3 text-right align-top">
            <PrimaryButton disabled={item.status === 'RETURNED'} onClick={() => onReturn(item)}>Return</PrimaryButton>
          </td>
        </tr>
      ))}
    </DataTable>
  );
}

function IssuedTable({ rows }: { rows: LibraryIssue[] }) {
  const sortedRows = useMemo(() => [...rows].sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')), [rows]);
  if (!sortedRows.length) return <EmptyState message="No issued book records found." />;
  return (
    <DataTable headers={['Book Title', 'Book No.', 'ISBN No.', 'Member Name', 'Author', 'Subject', 'Issue Date', 'Return Date', 'Status']}>
      {sortedRows.map((row) => (
        <tr key={row.id}>
          <Cell strong>{row.book?.title ?? '-'}</Cell>
          <Cell>{row.book?.bookNumber || '-'}</Cell>
          <Cell>{row.book?.isbnNumber || '-'}</Cell>
          <Cell>{row.member?.fullName ?? '-'}</Cell>
          <Cell>{row.book?.authorName || '-'}</Cell>
          <Cell>{row.book?.subject?.name ?? '-'}</Cell>
          <Cell>{formatDate(row.issueDate)}</Cell>
          <Cell>{formatDate(row.returnDate)}</Cell>
          <Cell><StatusPill status={row.status} /></Cell>
        </tr>
      ))}
    </DataTable>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>{headers.map((header) => <th key={header} className={`px-4 py-3 ${header === 'Actions' ? 'text-right' : ''}`}>{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`px-4 py-3 align-top ${strong ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{children}</td>;
}

function ActionCell({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <td className="px-4 py-3 align-top">
      <div className="flex justify-end gap-2">
        <SecondaryButton onClick={onEdit}>Edit</SecondaryButton>
        <DangerButton onClick={onDelete}>Delete</DangerButton>
      </div>
    </td>
  );
}

function StatusPill({ status }: { status: 'ACTIVE' | 'CANCELED' | 'ISSUED' | 'RETURNED' }) {
  const styles =
    status === 'ISSUED'
      ? 'bg-amber-100 text-amber-700'
      : status === 'RETURNED'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'ACTIVE'
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${styles}`}>{status === 'CANCELED' ? 'Canceled' : status}</span>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-2 last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function displayMemberType(value: LibraryMemberType) {
  if (value === 'STUDENT') return 'Student';
  if (value === 'TEACHER') return 'Teacher';
  return 'Staff';
}
