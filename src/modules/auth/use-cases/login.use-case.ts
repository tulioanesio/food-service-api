import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UsersRepository } from 'src/modules/users/repositories/users.repository';
import { LoginDto } from '../dto/login.dto';

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(dto: LoginDto) {
    const user = await this.usersRepository.findByLoginOrEmail(dto.login);
    const validPassword = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !user.isActive || user.deletedAt || !validPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        login: user.login,
        email: user.email,
        role: user.role,
      },
    };
  }
}
