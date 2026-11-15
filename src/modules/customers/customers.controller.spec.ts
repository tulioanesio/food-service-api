import { CustomersController } from './customers.controller';
import {
  CreateCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from './use-cases/customers.use-cases';

describe('CustomersController', () => {
  const createCustomer = { execute: jest.fn() };
  const listCustomers = { execute: jest.fn() };
  const getCustomer = { execute: jest.fn() };
  const updateCustomer = { execute: jest.fn() };

  const controller = new CustomersController(
    createCustomer as unknown as CreateCustomerUseCase,
    listCustomers as unknown as ListCustomersUseCase,
    getCustomer as unknown as GetCustomerUseCase,
    updateCustomer as unknown as UpdateCustomerUseCase,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates create to CreateCustomerUseCase', async () => {
    const dto = { name: 'Ana' };
    createCustomer.execute.mockResolvedValue({ id: 'c1', ...dto });

    await expect(controller.create(dto)).resolves.toEqual({ id: 'c1', ...dto });
    expect(createCustomer.execute).toHaveBeenCalledWith(dto);
  });

  it('delegates list to ListCustomersUseCase', async () => {
    const query = { page: 1, limit: 20 };
    const response = { data: [], meta: { page: 1, limit: 20, total: 0 } };
    listCustomers.execute.mockResolvedValue(response);

    await expect(controller.list(query)).resolves.toEqual(response);
    expect(listCustomers.execute).toHaveBeenCalledWith(query);
  });

  it('delegates get to GetCustomerUseCase', async () => {
    const customer = { id: 'c1', name: 'Ana' };
    getCustomer.execute.mockResolvedValue(customer);

    await expect(controller.get('c1')).resolves.toEqual(customer);
    expect(getCustomer.execute).toHaveBeenCalledWith('c1');
  });

  it('delegates update to UpdateCustomerUseCase', async () => {
    const dto = { name: 'Ana Clara' };
    const updated = { id: 'c1', name: 'Ana Clara' };
    updateCustomer.execute.mockResolvedValue(updated);

    await expect(controller.update('c1', dto)).resolves.toEqual(updated);
    expect(updateCustomer.execute).toHaveBeenCalledWith('c1', dto);
  });
});
