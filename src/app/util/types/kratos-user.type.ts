// Kratos identity user type
export interface KratosUser {
    id: string;
    traits: {
      name?: string;
      email?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
  