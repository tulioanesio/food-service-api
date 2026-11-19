import { NotFoundException } from '@nestjs/common';
import { CustomersRepository } from '../repositories/customers.repository';
import {
  CreateCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from './customers.use-cases';

describe('Customers use cases', () => {
  const repo = {
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
  };
  const repository = repo as unknown as CustomersRepository;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('CreateCustomerUseCase', () => {
    it('creates a customer via repository', async () => {
      const useCase = new CreateCustomerUseCase(repository);
      const dto = { name: 'Maria', cpf: '12345678901', phone: '11999998888' };
      const created = { id: 'c1', ...dto, createdAt: new Date() };
      repo.create.mockResolvedValue(created);

      await expect(useCase.execute(dto)).resolves.toEqual(created);
      expect(repo.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('GetCustomerUseCase', () => {
    it('returns the customer when found', async () => {
      const useCase = new GetCustomerUseCase(repository);
      const customer = { id: 'c1', name: 'Maria', cpf: null, phone: null };
      repo.get.mockResolvedValue(customer);

      await expect(useCase.execute('c1')).resolves.toEqual(customer);
      expect(repo.get).toHaveBeenCalledWith('c1');
    });

    it('throws NotFoundException when customer does not exist', async () => {
      const useCase = new GetCustomerUseCase(repository);
      repo.get.mockResolvedValue(null);

      await expect(useCase.execute('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('UpdateCustomerUseCase', () => {
    it('updates the customer when found', async () => {
      const useCase = new UpdateCustomerUseCase(repository);
      const dto = { name: 'Maria Silva' };
      const updated = { id: 'c1', name: 'Maria Silva', cpf: null, phone: null };
      repo.get.mockResolvedValue({ id: 'c1' });
      repo.update.mockResolvedValue(updated);

      await expect(useCase.execute('c1', dto)).resolves.toEqual(updated);
      expect(repo.update).toHaveBeenCalledWith('c1', dto);
    });

    it('throws NotFoundException when customer does not exist', async () => {
      const useCase = new UpdateCustomerUseCase(repository);
      repo.get.mockResolvedValue(null);

      await expect(
        useCase.execute('missing', { name: 'Novo' }),
      ).rejects.toThrow(NotFoundException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('ListCustomersUseCase', () => {
    it('lists customers without search filter', async () => {
      const useCase = new ListCustomersUseCase(repository);
      const items = [{ id: 'c1', name: 'Ana' }];
      repo.list.mockResolvedValue([items, 1]);

      const result = await useCase.execute({ page: 1, limit: 10 });

      expect(repo.list).toHaveBeenCalledWith({}, 1, 10);
      expect(result).toEqual({
        data: items,
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    });

    it('searches by name case-insensitively when search is text', async () => {
      const useCase = new ListCustomersUseCase(repository);
      repo.list.mockResolvedValue([[], 0]);

      await useCase.execute({ search: 'Ana', page: 2, limit: 5 });

      expect(repo.list).toHaveBeenCalledWith(
        {
          OR: [{ name: { contains: 'Ana', mode: 'insensitive' } }],
        },
        2,
        5,
      );
    });

    it('searches by name, cpf digits and normalized phone when search is numeric', async () => {
      const useCase = new ListCustomersUseCase(repository);
      repo.list.mockResolvedValue([[], 0]);

      await useCase.execute({
        search: '+55 (11) 99999-8888',
        page: 1,
        limit: 10,
      });

      expect(repo.list).toHaveBeenCalledWith(
        {
          OR: [
            { name: { contains: '+55 (11) 99999-8888', mode: 'insensitive' } },
            { cpf: { contains: '5511999998888' } },
            { phone: { contains: '11999998888' } },
          ],
        },
        1,
        10,
      );
    });

    it('handles punctuation-only search matching phone pattern without digits', async () => {
      const useCase = new ListCustomersUseCase(repository);
      repo.list.mockResolvedValue([[], 0]);

      await useCase.execute({ search: '---', page: 1, limit: 10 });

      expect(repo.list).toHaveBeenCalledWith(
        {
          OR: [{ name: { contains: '---', mode: 'insensitive' } }],
        },
        1,
        10,
      );
    });
  });
});
