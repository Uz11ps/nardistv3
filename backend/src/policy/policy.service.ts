import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy } from './policy.entity';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
  ) {}

  async getPolicy(type: 'privacy' | 'agreement'): Promise<Policy | null> {
    return this.policyRepository.findOne({ where: { type } });
  }

  async createOrUpdatePolicy(type: 'privacy' | 'agreement', content: string): Promise<Policy> {
    let policy = await this.policyRepository.findOne({ where: { type } });
    
    if (policy) {
      policy.content = content;
      return this.policyRepository.save(policy);
    } else {
      policy = this.policyRepository.create({ type, content });
      return this.policyRepository.save(policy);
    }
  }

  async getAllPolicies(): Promise<Policy[]> {
    return this.policyRepository.find();
  }
}

